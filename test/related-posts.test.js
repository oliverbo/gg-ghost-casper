const test = require('node:test');
const assert = require('node:assert/strict');

const {
    apiOrigin,
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

test('excludes the local current post when the API returns its production URL', () => {
    const posts = [post({postUrl: 'https://www.glamglare.com/music/current-post/'})];

    assert.deepEqual(normalizePosts(posts, 'http://localhost:2369/music/current-post/'), []);
});
