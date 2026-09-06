/* eslint-env browser */

(function (root, factory) {
    const relatedPosts = factory(root, root && root.document);

    if (typeof module === 'object' && module.exports) {
        module.exports = relatedPosts;
    } else {
        relatedPosts.init();
    }
})(typeof window !== 'undefined' ? window : undefined, function (window, document) {
    const DEFAULT_API_ORIGIN = 'https://glamglare-204017.appspot.com';
    const MAX_POSTS = 3;
    const REQUEST_TIMEOUT = 5000;
    const DEPRIORITIZED_TAG = 'song-pick-of-the-day';
    const POST_HOSTS = new Set(['glamglare.com', 'www.glamglare.com']);
    const LOCAL_POST_HOSTS = new Set(['localhost', '127.0.0.1']);

    function parseUrl(value, allowedHosts) {
        if (typeof value !== 'string') return null;

        try {
            const url = new URL(value);
            if (url.protocol !== 'https:' || (allowedHosts && !allowedHosts.has(url.hostname))) {
                return null;
            }
            return url;
        } catch (error) {
            return null;
        }
    }

    function postKey(url) {
        return url.pathname.replace(/\/$/, '');
    }

    function parseCurrentPostUrl(value) {
        const productionUrl = parseUrl(value, POST_HOSTS);
        if (productionUrl) return productionUrl;

        if (typeof value !== 'string') return null;

        try {
            const url = new URL(value);
            if (!LOCAL_POST_HOSTS.has(url.hostname) || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
                return null;
            }
            return url;
        } catch (error) {
            return null;
        }
    }

    function apiOrigin(value) {
        const configuredUrl = parseUrl(value);
        return configuredUrl ? configuredUrl.origin : DEFAULT_API_ORIGIN;
    }

    function timestamp(value) {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    function hasTag(post, tag) {
        return Array.isArray(post.tags) && post.tags.some(function (postTag) {
            return typeof postTag === 'string' && postTag.trim().toLowerCase() === tag;
        });
    }

    function normalizePosts(posts, currentPostUrl) {
        if (!Array.isArray(posts)) return [];

        const currentUrl = parseCurrentPostUrl(currentPostUrl);
        const currentKey = currentUrl ? postKey(currentUrl) : null;
        const seen = new Set();
        const normalized = [];

        posts.forEach(function (post) {
            if (!post || post.status !== 'published' || typeof post.title !== 'string' || !post.title.trim()) {
                return;
            }

            const url = parseUrl(post.postUrl, POST_HOSTS);
            if (!url) return;

            const key = post.id || postKey(url);
            if (postKey(url) === currentKey || seen.has(key)) return;

            seen.add(key);
            normalized.push(Object.assign({}, post, {_relatedPostUrl: url.href}));
        });

        return normalized
            .sort(function (first, second) {
                const priorityDifference = Number(hasTag(first, DEPRIORITIZED_TAG)) - Number(hasTag(second, DEPRIORITIZED_TAG));
                if (priorityDifference !== 0) return priorityDifference;

                return timestamp(second.postDate) - timestamp(first.postDate);
            })
            .slice(0, MAX_POSTS);
    }

    function createElement(name, className) {
        const element = document.createElement(name);
        if (className) element.className = className;
        return element;
    }

    function appendImage(card, post) {
        const imageUrl = parseUrl(post.imageUrl);
        if (!imageUrl) {
            card.classList.add('no-image');
            return;
        }

        const link = createElement('a', 'post-card-image-link');
        link.href = post._relatedPostUrl;

        const image = createElement('img', 'post-card-image');
        image.src = imageUrl.href;
        image.alt = post.title.trim();
        image.loading = 'lazy';
        link.appendChild(image);
        card.appendChild(link);
    }

    function appendDate(footer, value) {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return;

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const date = createElement('time', 'post-card-meta-date');
        date.dateTime = parsed.toISOString().slice(0, 10);
        date.textContent = String(parsed.getUTCDate()).padStart(2, '0') + ' ' + months[parsed.getUTCMonth()] + ' ' + parsed.getUTCFullYear();
        footer.appendChild(date);
    }

    function createPostCard(post) {
        const card = createElement('article', 'post-card');
        appendImage(card, post);

        const content = createElement('div', 'post-card-content');
        const contentLink = createElement('a', 'post-card-content-link');
        contentLink.href = post._relatedPostUrl;

        const header = createElement('header', 'post-card-header');
        const title = createElement('h2', 'post-card-title');
        title.textContent = post.title.trim();
        header.appendChild(title);
        contentLink.appendChild(header);

        if (typeof post.excerpt === 'string' && post.excerpt.trim()) {
            const excerpt = createElement('div', 'post-card-excerpt');
            excerpt.textContent = post.excerpt.trim();
            contentLink.appendChild(excerpt);
        }

        content.appendChild(contentLink);

        const footer = createElement('footer', 'post-card-meta');
        appendDate(footer, post.postDate);
        content.appendChild(footer);
        card.appendChild(content);

        return card;
    }

    function currentPostUrl(sourceDocument) {
        if (!sourceDocument) return null;

        const article = sourceDocument.querySelector('[data-current-post-url]');
        return article ? article.dataset.currentPostUrl : null;
    }

    async function load(container) {
        const postUrl = currentPostUrl(document);
        if (!parseCurrentPostUrl(postUrl)) return;

        const feed = container.querySelector('.read-more');
        if (!feed) return;

        const endpoint = new URL('/public/posts/related', apiOrigin(window.__BACKEND_URL__));
        endpoint.searchParams.set('postUrl', postUrl);

        const controller = new AbortController();
        const timeout = window.setTimeout(function () {
            controller.abort();
        }, REQUEST_TIMEOUT);

        try {
            const response = await window.fetch(endpoint.href, {
                headers: {Accept: 'application/json'},
                signal: controller.signal
            });
            if (!response.ok) return;

            const payload = await response.json();
            const posts = normalizePosts(payload && payload.result, postUrl);
            if (!posts.length) return;

            const fragment = document.createDocumentFragment();
            posts.forEach(function (post) {
                fragment.appendChild(createPostCard(post));
            });
            feed.replaceChildren(fragment);
            container.hidden = false;
        } catch (error) {
            // The server-rendered recent posts remain as the fallback.
        } finally {
            window.clearTimeout(timeout);
        }
    }

    function init() {
        if (!document || !window || !window.fetch || !window.AbortController) return;

        const container = document.querySelector('[data-related-posts]');
        if (container) load(container);
    }

    return {
        apiOrigin: apiOrigin,
        currentPostUrl: currentPostUrl,
        hasTag: hasTag,
        init: init,
        normalizePosts: normalizePosts,
        parseCurrentPostUrl: parseCurrentPostUrl,
        parseUrl: parseUrl
    };
});
