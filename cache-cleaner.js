const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const naturalSort = require('javascript-natural-sort');

const cacheService = require('./services/cache.service');

const cachesFolderPath = path.join(cacheService.getCachesFolderPath());

let directories = [];
let directoriesWithResponses = [];
let responses = [];
let throttledResponses = [];
let throttledDirectories = [];

const getDirsInDir = (dir) => {
    let filesAndDirs = fs.readdirSync(dir);
    let dirs = filesAndDirs
        .map((fileOrDir) => path.join(dir, fileOrDir))
        .filter((fileOrDir) => fs.lstatSync(fileOrDir).isDirectory());
    directories = directories.concat(dirs);
    dirs.forEach(getDirsInDir);
}

const getDirsWithResponses = (dirs) => {

    let dirsWithResponses = dirs.filter((dir) => {
    const isFilePredicate = (fileOrDir) => fs.lstatSync(path.join(dir, fileOrDir)).isFile();

        let filesOrDirs = fs.readdirSync(dir)
            .filter(isFilePredicate)
            .filter((fileOrDir) => fileOrDir.indexOf('.') === -1);
        return filesOrDirs.some(isFilePredicate);
    });
    directoriesWithResponses = dirsWithResponses;
}

const getResponsesInDirs = (dirsWithResponses) => {
    dirsWithResponses.forEach((dirWithResponses) => {
        let files = fs.readdirSync(dirWithResponses)
            .map((fileOrDir) => path.join(dirWithResponses, fileOrDir))
            .filter((fileOrDir) => fs.lstatSync(fileOrDir).isFile())
        responses = responses.concat(files);
    })
}

const getThrottledResponses = (dirsWithResponses) => {
    dirsWithResponses.forEach((dir) => {
        let filesOrDirs = fs.readdirSync(dir);

        let files = filesOrDirs
            .map((fileOrDir) => path.join(dir, fileOrDir))
            .filter((fileOrDir) => {
                return fs.lstatSync(fileOrDir).isFile();
            });

        let throttledResps = files.filter((file) => {
            let response = fs.readFileSync(file, 'utf8');
            return response.indexOf('<Code>RequestThrottled</Code>') !== -1 ||
                   response.indexOf('<Code>QuotaExceeded</Code>') !== -1;
        });

        throttledResponses = throttledResponses.concat(throttledResps);
    })
}

const cleanThrottledResponses = (throttledResps) => {
    throttledResps.forEach((throttledResponse) => {
        console.log(`UNLINKING .${throttledResponse}`)
        fs.unlinkSync(throttledResponse);
    })
}

const renameResponsesInDir = (dir) => {
    if (path.relative(dir, cachesFolderPath) ==='..') {
        console.log('Skipping caches folder...');
        return;
    }

    let files = fs.readdirSync(dir)
        .filter((fileOrDir) => fileOrDir.indexOf('.') === -1)
        .map((fileOrDir) => path.join(dir, fileOrDir))
        .filter((fileOrDir) => fs.lstatSync(fileOrDir).isFile());


    if (files.length === 0) {
        console.log(`Skipping NO_FILES ${dir}`);
        return;
    }
    
    let filenames = files.map(file => path.basename(file));

    filenames.sort(naturalSort);
    files.sort(naturalSort);

    const comparisonArray = Array(filenames.length).fill(0).map((v, i) => (i + 1).toString());

    if (_.isEqual(filenames, comparisonArray)) {
        console.log(`Skipping CORRECT_NAMES ${dir}`);
        return;
    }

    files.forEach((file) => {
        console.log('TEMP RENAME\n', file, '\n', file + '_');
        fs.renameSync(file, file + '_');
    })

    files.forEach((file, index) => {
        console.log('PERM RENAME', '\n',file + '_','\n', path.join(path.dirname(file), (index + 1).toString()));
        fs.renameSync(file + '_', path.join(path.dirname(file), (index + 1).toString()));
    })
}

const renameResponsesInDirs = (dirs) => {
    dirs.forEach((dir) => renameResponsesInDir(dir));
}

getDirsInDir(cachesFolderPath);
getDirsWithResponses(directories);
getThrottledResponses(directoriesWithResponses);
throttledDirectories = _.uniq(throttledResponses.map(path.dirname));
cleanThrottledResponses(throttledResponses);
renameResponsesInDirs(directoriesWithResponses);