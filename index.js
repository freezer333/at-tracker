const onFinished = require('on-finished');
const crypto = require('crypto');
/*
The middleware records the the following on each request:
   - url
   - method (get/post/put/delete) (optional)
   - query parameters (optional)
   - request headers (optional)
   - request body (if any) optional
   - user id (if any)
   - timestamp
   - at (a unique id for the browser, using a cookie).
   - statusCode
   - error (if any)
   - response headers (optional)
   - TTL - expiration date, will be cleaned on app start up
     and every hour after.  Default to 30 days.
*/
const store = {
    save: (tracker) => {
        console.log(`@: `, tracker.method, tracker.url, tracker.statusCode, tracker.user ? `User=${tracker.user.id}` : null);
    },
    clean: () => {
        console.log(`@: Cleaned`);
    }
}
const at = (app, options = { store: store, user: req => null, ttl: 30 * 24 * 60 * 60 * 1000, persist: (p) => p }) => {
    const _store = options.store || store;
    const _ttl = options.ttl || 30 * 24 * 60 * 60 * 1000;
    const _persist = options.persist || (p => p);
    const m = (req, res, next) => {
        const tracker = {
            url: req.url,
            method: req.method,
            query: req.query,
            headers: req.headers,
            body: req.body,
            user: options.user(req),
            timestamp: new Date(),
            at: req.cookies.at || crypto.randomUUID(),
            statusCode: null,
            error: null,
            resHeaders: null,
            ttl: new Date(new Date().getTime() + _ttl)
        };
        req.at = tracker;
        res.at = tracker;
        // Set at_id cookie, with no expiration
        res.cookie('at', tracker.at, { httpOnly: true, sameSite: 'Strict', secure: process.env.NODE_ENV === 'production' });

        onFinished(res, function (err, res) {
            if (err) {
                tracker.error = err;
            }
            tracker.elapsed = new Date() - tracker.timestamp;
            // Add the response headers
            tracker.resHeaders = res.getHeaders();
            // Add the status code
            tracker.statusCode = res.statusCode;
            _store.save(_persist(tracker));
        });
        next();
    };
    app.use(m);
    // Clean up expired trackers
    setInterval(_store.clean, 60 * 60 * 1000);
}

module.exports = at;