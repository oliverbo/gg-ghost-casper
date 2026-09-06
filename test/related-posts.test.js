const test = require('node:test');
const assert = require('node:assert/strict');

const {
    apiOrigin,
    currentPostUrl: readCurrentPostUrl,
    hasTag,
    normalizePosts,
    parseCurrentPostUrl,
    parseUrl
} = require('../assets/js/related-posts');

const currentUrl = 'https://www.glamglare.com/music/current-post/';

function post(overrides) {
    return {
        id: 'post-1',
        title: 'Related post',
        postUrl: 'https://www.glamglare.com/music/related-post/',
        postDate: '2026-09-01T12:00:00.000Z',
        status: 'published',
        ...overrides
    };
}

test('accepts only HTTPS URLs on an allowed host', () => {
    const hosts = new Set(['www.glamglare.com']);

    assert.equal(parseUrl('https://www.glamglare.com/music/post/', hosts).hostname, 'www.glamglare.com');
    assert.equal(parseUrl('http://www.glamglare.com/music/post/', hosts), null);
    assert.equal(parseUrl('https://example.com/music/post/', hosts), null);
    assert.equal(parseUrl('not a URL', hosts), null);
});

test('uses a valid injected backend URL with a production fallback', () => {
    assert.equal(apiOrigin('https://glamglare-dev.uc.r.appspot.com/path'), 'https://glamglare-dev.uc.r.appspot.com');
    assert.equal(apiOrigin('http://insecure.example.com'), 'https://glamglare-204017.appspot.com');
    assert.equal(apiOrigin(undefined), 'https://glamglare-204017.appspot.com');
});

test('accepts local URLs only for identifying the current post', () => {
    assert.equal(parseCurrentPostUrl('http://localhost:2369/music/current-post/').hostname, 'localhost');
    assert.equal(parseCurrentPostUrl('http://127.0.0.1:2369/music/current-post/').hostname, '127.0.0.1');
    assert.equal(parseCurrentPostUrl('http://www.glamglare.com/music/current-post/'), null);
    assert.equal(parseCurrentPostUrl('http://example.com/music/current-post/'), null);
});

test('reads the current post URL from the article post context', () => {
    const sourceDocument = {
        querySelector: () => ({
            dataset: {currentPostUrl: 'http://localhost:2369/music/current-post/'}
        })
    };

    assert.equal(readCurrentPostUrl(sourceDocument), 'http://localhost:2369/music/current-post/');
    assert.equal(readCurrentPostUrl({querySelector: () => null}), null);
    assert.equal(readCurrentPostUrl(null), null);
});

test('matches post tags case-insensitively', () => {
    assert.equal(hasTag(post({tags: [' Song-Pick-of-the-Day ']}), 'song-pick-of-the-day'), true);
    assert.equal(hasTag(post({tags: ['qa']}), 'song-pick-of-the-day'), false);
    assert.equal(hasTag(post({tags: undefined}), 'song-pick-of-the-day'), false);
});

test('filters, deduplicates, sorts, and limits related posts', () => {
    const posts = [
        post({id: 'old', postUrl: 'https://www.glamglare.com/music/old/', postDate: '2026-01-01T00:00:00.000Z'}),
        post({id: 'newest', postUrl: 'https://www.glamglare.com/music/newest/', postDate: '2026-06-01T00:00:00.000Z'}),
        post({id: 'middle', postUrl: 'https://glamglare.com/music/middle/', postDate: '2026-05-01T00:00:00.000Z'}),
        post({id: 'new', postUrl: 'https://www.glamglare.com/music/new/', postDate: '2026-04-01T00:00:00.000Z'}),
        post({id: 'newest', postUrl: 'https://www.glamglare.com/music/duplicate/', postDate: '2026-07-01T00:00:00.000Z'}),
        post({id: 'current', postUrl: currentUrl}),
        post({id: 'draft', postUrl: 'https://www.glamglare.com/music/draft/', status: 'draft'}),
        post({id: 'external', postUrl: 'https://example.com/music/external/'}),
        post({id: 'untitled', postUrl: 'https://www.glamglare.com/music/untitled/', title: '  '})
    ];

    assert.deepEqual(
        normalizePosts(posts, currentUrl).map((item) => item.id),
        ['newest', 'middle', 'new']
    );
});

test('leaves invalid API results empty', () => {
    assert.deepEqual(normalizePosts(null, currentUrl), []);
    assert.deepEqual(normalizePosts({}, currentUrl), []);
});

test('prioritizes editorial posts over newer song picks', () => {
    const posts = [
        post({id: 'newest-song-pick', postUrl: 'https://www.glamglare.com/music/newest-song-pick/', postDate: '2026-06-01T00:00:00.000Z', tags: ['song-pick-of-the-day']}),
        post({id: 'newer-review', postUrl: 'https://www.glamglare.com/music/newer-review/', postDate: '2026-04-01T00:00:00.000Z', tags: ['live-show-review']}),
        post({id: 'older-qa', postUrl: 'https://www.glamglare.com/music/older-qa/', postDate: '2026-03-01T00:00:00.000Z', tags: ['qa']}),
        post({id: 'older-song-pick', postUrl: 'https://www.glamglare.com/music/older-song-pick/', postDate: '2026-05-01T00:00:00.000Z', tags: ['song-pick-of-the-day']})
    ];

    assert.deepEqual(
        normalizePosts(posts, currentUrl).map((item) => item.id),
        ['newer-review', 'older-qa', 'newest-song-pick']
    );
});

test('excludes the local current post when the API returns its production URL', () => {
    const posts = [post({postUrl: 'https://www.glamglare.com/music/current-post/'})];

    assert.deepEqual(normalizePosts(posts, 'http://localhost:2369/music/current-post/'), []);
});
