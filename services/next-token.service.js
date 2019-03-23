const fs = require('fs');
const path = require('path');
const CRC32 = require('crc-32');

const paramsService = require('./params.service');

const getNextTokenRegistryPath = (cachePath) => {
    return path.join(cachePath, 'next-token-registry.json');
}

const getNextTokenRegistry = (cachePath) => {
    const nextTokenRegistryPath = getNextTokenRegistryPath(cachePath);
    if (!fs.existsSync(nextTokenRegistryPath)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(nextTokenRegistryPath), 'utf8');
}

const appendNextTokenToNextTokenRegistry = (data, cachePath) => {
    const nextTokenRegistryPath = getNextTokenRegistryPath(cachePath);
    let nextTokenRegistry = getNextTokenRegistry(cachePath);
    Object.assign(nextTokenRegistry, data);
    fs.writeFileSync(nextTokenRegistryPath, JSON.stringify(nextTokenRegistry), 'utf8');
}

const getNextTokenFromResponseData = (data) => {
    const nextTokenRegex = new RegExp('<NextToken>(.*?)</NextToken>');
    const nextToken = data.match(nextTokenRegex)[1].toString();
    return nextToken;
}

const getHashedNextToken = (nextToken) => CRC32.str(nextToken);

const replaceNextTokenInParams = (params) => {
    const nextTokenParam = paramsService.getParam(params, 'NextToken');
    if (typeof nextTokenParam === 'undefined') {
        return params;
    }

    const hashedNextToken = getHashedNextToken(nextTokenParam.value);
    params[params.indexOf(nextTokenParam)].value = hashedNextToken;
    return params;
}

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

module.exports = {
    getNextTokenRegistryPath: getNextTokenRegistryPath,
    appendNextTokenToNextTokenRegistry: appendNextTokenToNextTokenRegistry,
    getNextTokenFromResponseData: getNextTokenFromResponseData,
    getHashedNextToken: getHashedNextToken,
    replaceNextTokenInParams: replaceNextTokenInParams
}