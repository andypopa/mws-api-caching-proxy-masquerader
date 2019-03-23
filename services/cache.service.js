const fs = require('fs');
const path = require('path');
const moment = require('moment');

const nextTokenService = require('./next-token.service');
const paramsService = require('./params.service');

let masqueradingTable = {};

const getTimestamp = (cachingProxy, masquerader) => {
    if (typeof cachingProxy === 'undefined' ||
        typeof masquerader === 'undefined') {
            throw `'cachingProxy' and 'masquerader' must be set before calling getTimestamp(). Call getMode() and store the result in global variables before calling this function.`;
        }

    let timestamp = Date.now().toString();
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

const encodeRequest = (relevantParams) => {
    return relevantParams
            .map((param) => `${param.name}=${param.value}`)
            .join('&');
}

const maybeMakeSubfolder = (parentFolderPath, subfolderName) => {
    const subfolderPath = path.join(parentFolderPath, subfolderName);
    if (!fs.existsSync(subfolderPath)) {
        fs.mkdirSync(subfolderPath);
    }
    return subfolderPath;
}

const resolveRequestFolder = (cachePath, req, bodyContent, cachingProxy) => {
    const folderResolver = cachingProxy ? maybeMakeSubfolder : path.join;
    let API = req.url.split('?')[0].split('/')[1];
    const params = paramsService.getParams(bodyContent, req);
    const paramsObj = paramsService.getParamsObj(params);
    const sellerId = paramsObj.SellerId;
    const action = paramsObj.Action;

    const nextTokenParam = paramsService.getParam(params, 'NextToken');
    
    if (typeof nextTokenParam !== 'undefined' && cachingProxy) {
        const nextToken = nextTokenParam.value;
        let nextTokenRegistryObj = {};
        nextTokenRegistryObj[nextToken] = nextTokenService.getHashedNextToken(nextToken);
        nextTokenService.appendNextTokenToNextTokenRegistry(nextTokenRegistryObj, cachePath);
    }

    const relevantParams = paramsService.filterIrrelevantParams(params);
    const relevantParamsWithHashedNextToken = nextTokenService.replaceNextTokenInParams(relevantParams);
    const encodedRequest = encodeRequest(relevantParamsWithHashedNextToken);

    const sellerIdFolderPath = folderResolver(cachePath, sellerId);
    const APIFolderPath = folderResolver(sellerIdFolderPath, API);
    const actionFolderPath = folderResolver(APIFolderPath, action);

    let requestFolder = actionFolderPath;

    if (encodedRequest.length > 128) {
        requestFolder = encodedRequest.split('&').reduce((prev, cur) => {
            return folderResolver(prev, cur);
        }, actionFolderPath);
    } else {
        requestFolder = folderResolver(actionFolderPath, encodedRequest);
    }

    return requestFolder;
}

const cache = (cachePath, data, req, bodyContent, cachingProxy) => {
    let requestFolder = resolveRequestFolder(cachePath, req, bodyContent, cachingProxy);

    const savedResponsesNo = fs.readdirSync(requestFolder)
                                .filter((a) => a[0] !== '.')
                                .length;
    
    const responseNo = savedResponsesNo + 1;
    const responseFilename = responseNo.toString();
    const responsePath = path.join(requestFolder, responseFilename);

    // eslint-disable-next-line no-console
    console.log()
    // eslint-disable-next-line no-console
    console.log(`Caching ${req.method} ${req.url} (${responseNo})`);
    // eslint-disable-next-line no-console
    console.log(`Writing ${responsePath}`);
    fs.writeFileSync(responsePath, data);
    return responsePath;
}

const getCachedRequest = (cachePath, req, bodyContent, cachingProxy) => {
    let requestFolder = resolveRequestFolder(cachePath, req, bodyContent, cachingProxy);
    
    const savedResponsesNo = fs.readdirSync(requestFolder)
                                .filter((a) => a[0] !== '.')
                                .length;
    
    if (typeof masqueradingTable[requestFolder] === undefined) {
        masqueradingTable[requestFolder] = 1;
    } else {
        masqueradingTable[requestFolder] = masqueradingTable[requestFolder] < savedResponsesNo ?
            masqueradingTable[requestFolder] + 1 :
            1;
    }
    const responseFilename = masqueradingTable[requestFolder].toString();
    const responsePath = path.join(requestFolder, responseFilename);

    // eslint-disable-next-line no-console
    console.log()
    // eslint-disable-next-line no-console
    console.log(`Masquerading ${req.method} ${req.url} (${masqueradingTable[requestFolder]}/${savedResponsesNo})`);
    // eslint-disable-next-line no-console
    console.log(`Reading ${responsePath}`);

    return fs.readFileSync(responsePath, 'utf8');
}

module.exports = {
    getTimestamp: getTimestamp,
    getCachesFolderPath: getCachesFolderPath,
    getCaches: getCaches,
    getLatestCache: getLatestCache,
    getLatestCacheFolder: getLatestCacheFolder,
    getCachedRequest: getCachedRequest,
    cache: cache
}