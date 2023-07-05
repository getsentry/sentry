#!/usr/bin/env ts-node
/* eslint-disable no-console, import/no-nodejs-modules, @typescript-eslint/no-shadow */

/**
 * Script from: https://www.flux.ai/p/blog/convert-your-typescript-codebase-to-no-unchecked-indexed-access
 *
 * To generate noUncheckedIndexedAccess.txt:
 * 1. Edit `config/tsconfig.base.json` so `"noUncheckedIndexedAccess": true,`
 * 2. Generate a list of violations:
 *    $ cd ~/code/sentry
 *    $ tsc -p config/tsconfig.build.json | grep 'error T' > noUncheckedIndexedAccess.txt
 * 3. Optionally trim the list to just files you care about
 * 4. Run this script:
 *    $ ./bin/fix-noUncheckedIndexedAccess.ts
 * 5. rm noUncheckedIndexedAccess.txt
 */

import {readFileSync, writeFileSync} from 'fs';

type ErrorLines = {lineNum: number; message: string; path: string}[];

// NOTE: these should be idempotent for safety!
const replacers: [RegExp, string][] = [
  [/(\w+\.\w+\.\w+)\.(\w+)/g, '$1!.$2'], // a.b.c.d to a.b.c!.d
  [/(\w+\[(\w|\.)+\])!*/g, '$1!'], // add ! after []
  [/(\w+\])(\[\w+\])/g, '$1!$2'], // add ! between [][]
  [/(\[\w+\])(\.\w+)/g, '$1!$2'], // add ! between [] and .
  [/(\[\d+\]?)!*/g, '$1!'], // add ! after [0]
  // START CORRECTIONS
  [/\]!\) =>/g, ']) =>'], // correcting add ! above
  [/\]! =/g, '] ='], // correcting add ! above
];

const precede = 2;
const pathPrefix = './';

function main() {
  const txt = readFileSync('./noUncheckedIndexedAccess.txt', 'utf-8');
  const errorLines = parseErrorLines(txt);
  errorLines.forEach(errorLine => {
    let lineText = readLine(
      pathPrefix + errorLine.path,
      errorLine.lineNum,
      precede
    ) as string;
    replacers.forEach(([match, replacement]) => {
      const newLineText = getNewLineText(lineText, match, replacement);
      if (newLineText) {
        lineText = newLineText;
      }
    });
    console.log('\n---');
    console.log(errorLine.path, errorLine.lineNum, '\n', lineText);
    console.log('---\n');
    writeLine(pathPrefix + errorLine.path, errorLine.lineNum, lineText, precede);
  });
}

function getNewLineText(lineText: string, match: RegExp, replacement: string) {
  return (
    lineText
      .split('\n')
      // @ts-ignore: ignore missing string method
      .map(line => line.replaceAll(match, replacement))
      .join('\n')
  );
}

function parseErrorLines(txt: string): ErrorLines {
  return txt
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [pathPlus, message] = line.split(': error ');
      const pieces = pathPlus?.split('(');
      if (!pieces || !pieces[0] || !pieces[1] || !message) {
        throw new Error(`Missing bits in line: ${line}`);
      }
      const numberPieces = pieces[1].split(',', 1);
      if (!numberPieces || !numberPieces[0]) {
        throw new Error(`Missing numbers in pieces: ${pieces}`);
      }
      const lineNum = parseInt(numberPieces[0], 10);
      if (!(lineNum > 0 && lineNum < 1000000)) {
        throw new Error(`Bad line number: ${lineNum}`);
      }
      return {
        path: pieces[0],
        lineNum,
        message,
      };
    });
}

function readLine(filename: string, lineNum: number, precede: number) {
  const lines = readFileSync(filename, 'utf8').split('\n');
  return lines.slice(lineNum - 1 - precede, lineNum).join('\n');
}

function writeLine(filename: string, lineNum: number, lineText: string, precede: number) {
  const lines = readFileSync(filename, 'utf8').split('\n');
  lines.splice(lineNum - 1 - precede, precede + 1, ...lineText.split('\n'));
  writeFileSync(filename, lines.join('\n'));
}

main();
