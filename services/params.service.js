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

const getParamsExpress = (expressReq) => {
    return getParams(expressReq.body, expressReq);
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

const getParam = (params, paramName) => {
    return params.filter((param) => param.name === paramName)[0];
}

const encodeParams = (params) => params.map((param) => `${param.name}=${param.value}`).join('&');

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
        'AvailableToDate',
        'Subscription.Destination.AttributeList.member.1.Value',
        'Destination.AttributeList.member.1.Value'
    ]
    return params.filter((param) => {
        return irrelevantParams.indexOf(param.name) === -1
    });
}

module.exports = {
    getParamsFromQuery: getParamsFromQuery,
    getParams: getParams,
    getParamsExpress: getParamsExpress,
    getParamsObj: getParamsObj,
    getParam: getParam,
    encodeParams: encodeParams,
    filterIrrelevantParams: filterIrrelevantParams
}