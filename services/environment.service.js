const getMode = () => {
    const cachingProxy = process.argv[2] === 'caching-proxy';
    const masquerader = process.argv[2] === 'masquerader';

    return {
        cachingProxy: cachingProxy,
        masquerader: masquerader
    }
}

module.exports = {
    getMode: getMode
}