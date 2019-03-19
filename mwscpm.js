const fs = require('fs');
const path = require('path');
const proxy = require('express-http-proxy');
const app = require('express')();
const moment = require('moment');
const CRC32 = require('crc-32');

const port = 9666;

const getCachesFolderPath = () => {
    return path.join(process.cwd(), '/data');
}

const getCaches = () => {
    try {
        const dataFolder = getCachesFolderPath();
        const caches = fs.readdirSync(dataFolder).filter((a) => a.indexOf('.') === -1);
        return caches;
    } catch (err) {
        throw err;
    }
}

const getLatestCache = () => {
    const caches = getCaches();

    if (caches.length === 0) {
        throw 'No caches available. Run mwscpm in caching-proxy mode before running in masquerader mode.';
    }

    const latestCache = caches[caches.length - 1];
    return latestCache;
}

const getLatestCacheFolder = () => {
    return path.join(getCachesFolderPath(), getLatestCache());
}

const getTimestamp = () => {
    if (typeof masquerader === 'undefined' ||
        typeof cachingProxy === 'undefined') {
            throw `'masquerader' and 'cachingProxy' must be set before calling getTimestamp(). Call getMode() and store the result in global variables before calling this function.`;
        }

    const timestamp = Date.now().toString();
    const maybeTimestampArg = process.argv[3];

    if (masquerader && typeof process.argv[3] === 'undefined') {
        timestamp = getLatestCache();
    }

    if (masquerader && typeof maybeTimestampArg !== 'undefined') {
        if (moment.isValid(+maybeTimestampArg)) {
            timestamp = getLatestCache();
        } else {
            throw `Timestamp argument '${maybeTimestampArg}' but is not a valid moment.`;
        }
    }

    return timestamp;
}

const getMode = () => {
    const cachingProxy = process.argv[2] === 'caching-proxy';
    const masquerader = process.argv[2] === 'masquerader';

    return {
        cachingProxy: cachingProxy,
        masquerader: masquerader
    }
}

const maybeMakeSubfolder = (parentFolderPath, subfolderName) => {
    const subfolderPath = path.join(parentFolderPath, subfolderName);
    if (!fs.existsSync(subfolderPath)) {
        fs.mkdirSync(subfolderPath);
    }
    return subfolderPath;
}

const getParamsFromQuery = (query) => {
    return query.toString()
    .split('&')
    .map((paramAndValue) => {
        const paramAndValueArr = paramAndValue.split('=');
        return {
            name: paramAndValueArr[0],
            value: paramAndValueArr[1]
        }
    });
}

const getParams = (bodyContent, req) => {
    const query = {
        'GET': req.url.split('?')[1],
        'POST': bodyContent
    }
    return getParamsFromQuery(query[req.method]);
}

const getParamsObj = (params) => {
    return params.reduce((prev, cur) => {
        let obj = {};
        obj[cur.name] = cur.value;
        Object.assign(prev, obj);
        return prev;
    }, {});
}

const { cachingProxy, masquerader } = getMode();
const timestamp = getTimestamp();

let cachePath = '';

if (cachingProxy) {
    cachePath = path.join(getCachesFolderPath(), timestamp);
    fs.mkdirSync(cachePath);
} else {
    cachePath = getLatestCacheFolder();
}

if (process.argv.length < 3) {
    console.log(`USAGE: node mwscpm caching-proxy|masquerader`);
    process.exit();
}

const encodeRequest = (relevantParams) => {
    return encodeURIComponent(
        relevantParams
            .map((param) => `${param.name}=${param.value}`)
            .join('&')
    );
}

const filterIrrelevantParams = (params) => {
    const irrelevantParams = [
        'AWSAccessKeyId',
        'Action',
        'MWSAuthToken',
        'SellerId',
        'SignatureMethod',
        'SignatureVersion',
        'Timestamp',
        'Version',
        'Signature',
        'LastUpdatedAfter',
        'LastUpdatedBefore',
        'FinancialEventGroupStartedAfter',
        'FinancialEventGroupStartedBefore',
        'StartDate',
        'EndDate',
        'QueryStartDateTime',
        'QueryEndDateTime',
        'AvailableFromDate',
        'AvailableToDate'
    ]
    return params.filter((param) => {
        return irrelevantParams.indexOf(param.name) === -1
    });
}

const getNextTokenRegistryPath = () => {
    return path.join(cachePath, 'next-token-registry.json');
}

const getNextTokenRegistry = () => {
    const nextTokenRegistryPath = getNextTokenRegistryPath();
    if (!fs.existsSync(nextTokenRegistryPath)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(nextTokenRegistryPath), 'utf8');
}

const appendNextTokenToNextTokenRegistry = (data) => {
    const nextTokenRegistryPath = getNextTokenRegistryPath();
    let nextTokenRegistry = getNextTokenRegistry();
    Object.assign(nextTokenRegistry, data);
    fs.writeFileSync(nextTokenRegistryPath, JSON.stringify(nextTokenRegistry), 'utf8');
}

const getNextTokenFromResponseData = (data) => {
    const nextTokenRegex = new RegExp('<NextToken>(.*?)</NextToken>');
    const nextToken = data.match(nextTokenRegex)[1].toString();
    return nextToken;
}

const getHashedNextToken = (nextToken) => CRC32.str(nextToken);

// const encodeNextToken = (dataBuffer) => {
//     const data = dataBuffer.toString();
//     if (data.indexOf('<NextToken>')  === -1) {
//         return Buffer.from(data);
//     }
//     const nextToken = getNextTokenFromResponseData(data);
//     const hashedNextToken = getHashedNextToken(nextToken);
//     const dataWithHashedNextToken = data.replace(nextTokenRegex, '<NextToken>' + hashedNextToken + '</NextToken>');
//     let nextTokenRegistryObj = {};
//     nextTokenRegistryObj[nextToken] = hashedNextToken;
//     appendNextTokenToNextTokenRegistry(nextTokenRegistryObj);
//     return hashedNextToken;
// }

const getParam = (params, paramName) => {
    return params.filter((param) => param.name === paramName)[0];
}

const encodeParams = (params) => params.map((param) => `${param.name}=${param.value}`).join('&');

const replaceNextTokenInParams = (params) => {
    const nextTokenParam = getParam(params, 'NextToken');
    if (typeof nextTokenParam === 'undefined') {
        return params;
    }

    const hashedNextToken = getHashedNextToken(nextTokenParam.value);
    params[params.indexOf(nextTokenParam)].value = hashedNextToken;
    return params;
}

// const proxyReqPathResolver = (bodyContent, req) => {
//     if (req.method === 'GET') {
//         const params = getParams(bodyContent, req);

//         const encodedParams = replaceNextTokenInParams(params);
//         return req.url.split('?')[0] + '?' + encodedParams;
//     }
//     return req.url;
// }

// const proxyReqBodyDecorator = (bodyContent, req) => {
//     if (req.method === 'POST') {
//         const params = getParams(bodyContent, req);
//         const paramsObj = getParamsObj(params);
        
//         if(typeof params.NextToken !== 'undefined') {
//             //replace next token
//         }
//     }
// }

const userResDecorator = (proxyRes, data, req, userRes, bodyContent) => {
    // data = encodeNextToken(data);
    let API = req.url.split('?')[0].split('/')[1];
    const params = getParams(bodyContent, req);
    const paramsObj = getParamsObj(params);
    const sellerId = paramsObj.SellerId;
    const action = paramsObj.Action;

    const nextTokenParam = getParam(params, 'NextToken');
    
    if (typeof nextTokenParam !== 'undefined') {
        const nextToken = nextTokenParam.value;
        let nextTokenRegistryObj = {};
        nextTokenRegistryObj[nextToken] = getHashedNextToken(nextToken);
        appendNextTokenToNextTokenRegistry(nextTokenRegistryObj);
    }

    const relevantParams = filterIrrelevantParams(params);
    const relevantParamsWithHashedNextToken = replaceNextTokenInParams(relevantParams);
    const encodedRequest = encodeRequest(relevantParamsWithHashedNextToken);

    const sellerIdFolderPath = maybeMakeSubfolder(cachePath, sellerId);
    const APIFolderPath = maybeMakeSubfolder(sellerIdFolderPath, API);
    const actionFolderPath = maybeMakeSubfolder(APIFolderPath, action);

    let requestFolder = actionFolderPath;

    if (encodedRequest.length > 128) {
        requestFolder = encodedRequest.split('%26').reduce((prev, cur) => {
            return maybeMakeSubfolder(prev, cur);
        }, actionFolderPath);
    } else {
        requestFolder = maybeMakeSubfolder(actionFolderPath, encodedRequest);
    }

    const savedResponsesNo = fs.readdirSync(requestFolder)
                                .filter((a) => a[0] !== '.')
                                .length;
    
    const responseNo = savedResponsesNo + 1;
    const responseFilename = responseNo.toString();
    const responsePath = path.join(requestFolder, responseFilename);

    fs.writeFileSync(responsePath, data);
    return data;
}

app.use('/', proxy('mws.amazonservices.com', {
    https: true,
    // proxyReqBodyDecorator: proxyReqBodyDecorator,
    userResDecorator: userResDecorator
}));

app.listen(port, () => console.log(`MWS proxy listening on port ${port}`));