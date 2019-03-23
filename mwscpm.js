const fs = require('fs');
const path = require('path');
const proxy = require('express-http-proxy');
const app = require('express')();
const bodyParser = require('body-parser');
const _ = require('lodash');

const cacheService = require('./services/cache.service');
const environmentService = require('./services/environment.service');

const port = 9666;

const { cachingProxy, masquerader } = environmentService.getMode();
const timestamp = cacheService.getTimestamp(cachingProxy, masquerader);

let cachePath = '';

if (cachingProxy) {
    cachePath = path.join(cacheService.getCachesFolderPath(), timestamp);
    fs.mkdirSync(cachePath);
} else {
    cachePath = cacheService.getLatestCacheFolder();
}

if (process.argv.length < 3) {
    // eslint-disable-next-line no-console
    console.log(`USAGE: node mwscpm caching-proxy|masquerader`);
    process.exit();
}

// const proxyReqPathResolver = (bodyContent, req) => {
//     if (req.method === 'GET') {
//         const params = paramsService.getParams(bodyContent, req);

//         const encodedParams = nextTokenService.replaceNextTokenInParams(params);
//         return req.url.split('?')[0] + '?' + encodedParams;
//     }
//     return req.url;
// }

// const proxyReqBodyDecorator = (bodyContent, req) => {
//     if (req.method === 'POST') {
//         const params = paramsService.getParams(bodyContent, req);
//         const paramsObj = paramsService.getParamsObj(params);
        
//         if(typeof params.NextToken !== 'undefined') {
//             //replace next token
//         }
//     }
// }

const userResDecorator = (proxyRes, data, req, userRes, bodyContent) => {
    cacheService.cache(cachePath, data, req, bodyContent, cachingProxy, masquerader);
    return data;
}

let appOptions = {
    https: true,
    // proxyReqBodyDecorator: proxyReqBodyDecorator,
}

if (cachingProxy) {
    Object.assign(appOptions, {
        userResDecorator: userResDecorator
    })
}

// if (masquerader) {
//     Object.assign(appOptions, {
//         proxyReqBodyDecorator: proxyReqBodyDecorator,
//         proxyReqPathResolver: proxyReqPathResolver
//     })
// }

const getStatus = (cache) => {
    if (cache.indexOf('<Code>RequestThrottled</Code>') !== -1) return 503;
    if (cache.indexOf('<Code>QuotaExceeded</Code>') !== -1) return 503;
    return 200;
}

if (cachingProxy) {
    app.use('/', proxy('mws.amazonservices.com', appOptions));
}

if (masquerader) {
    app.use(bodyParser.urlencoded({ extended: false }));
    app.all('*', function(req, res) {
        let paramsEncoded = [];
        _.forOwn(req.body, (v, k) => {
            paramsEncoded.push(`${k}=${v}`);
        });
        let bodyContent = paramsEncoded.join('&');
        const cache = cacheService.getCachedRequest(cachePath, req, bodyContent, cachingProxy);
        res.status(getStatus(cache)).send(cache);
    });
}

app.listen(port, () => {
    if (cachingProxy) {
// eslint-disable-next-line no-console
        console.log(`MWS caching proxy listening on port ${port}`);
    }
    if (masquerader) {
// eslint-disable-next-line no-console
        console.log(`MWS masquerader listening on port ${port}`);
    }
});