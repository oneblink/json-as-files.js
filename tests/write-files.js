'use strict';

// Node.js built-ins

const path = require('path');

// foreign modules

const pify = require('pify');
const fsp = pify(require('graceful-fs'));
const mkdirpp = pify(require('mkdirp'));
const test = require('ava');

// local modules

const readJSON = require('../lib/read').readJSON;
const isFileReference = require('../lib/read').isFileReference;
const readData = require('..').readData;
const writeData = require('..').writeData;

// this module

const TEMP_ROOT = path.join(__dirname, '..', 'tmp');
const FILES_PATH = path.join(TEMP_ROOT, 'files.json');

function fsUnlinkFile (filePath) {
  return fsp.unlink(filePath)
    .catch((err) => {
      // it's fine if the file is already gone
      if (err.code !== 'ENOENT') {
        throw err;
      }
    });
}

test.before(`mkdir -p TEMP_ROOT`, (t) => mkdirpp(TEMP_ROOT));

test.beforeEach('copy ./fixtures/files.json -> ../tmp/files.json', () => {
  return fsp.readFile(path.join(__dirname, 'fixtures', 'files.json'), 'utf8')
    .then((contents) => {
      return fsp.writeFile(path.join(TEMP_ROOT, 'files.json'), contents, 'utf8');
    });
});

['abc.txt', 'ghi.txt'].forEach((filename) => {
  test.before(`rm ../tmp/${filename}`, () => {
    return fsUnlinkFile(path.join(TEMP_ROOT, filename));
  });
});

const INPUT = {
  deep: {
    nested: {
      abc: 'new abc',
      array: [
        456,
        'new ghi'
      ]
    }
  }
};

test.beforeEach('writeData({ filePath: "../tmp/files.json", data: ... })', (t) => {
  return writeData({ filePath: FILES_PATH, data: INPUT });
});

test('expected contents: abc.txt, ghi.txt', (t) => {
  const ABC_PATH = path.join(TEMP_ROOT, 'abc.txt');
  const GHI_PATH = path.join(TEMP_ROOT, 'ghi.txt');
  return fsp.readFile(ABC_PATH, 'utf8')
    .then((abc) => {
      t.is(abc, INPUT.deep.nested.abc);

      return fsp.readFile(GHI_PATH, 'utf8');
    })
    .then((ghi) => {
      t.is(ghi, INPUT.deep.nested.array[1]);
    });
});

test('expected contents: files.json', (t) => {
  return readJSON({ filePath: FILES_PATH }, 'utf8')
    .then((rawData) => {
      t.ok(isFileReference(rawData.deep.nested.abc));
      t.is(rawData.deep.nested.abc.$file, 'abc.txt');
      t.ok(isFileReference(rawData.deep.nested.array[1]));
      t.is(rawData.deep.nested.array[1].$file, 'ghi.txt');

      return readData({ filePath: FILES_PATH });
    })
    .then((output) => {
      t.same(output, INPUT);
    });
});