import * as cp from 'child_process';
import * as fs from 'fs';
import * as readline from 'readline';

// import * as ts from 'typescript';

// Plan:
// Do we need errors.txt, or can we leverage ts compiler for this?
// - If we use ts compiler, then we need to create a valid AST via transform which is tedious
// - if we output errors.txt, then we can just replace the value via
// If we pass a file, does module resolution pull it from the imported files?
// Introspect index type and find errors
// - if index access is on array with type NonNullable<T> then we should fix it
// - if index access is on array with Nullable<T> then we should skip it

// Create a report only version that only shows the errors that are fixable and errors that should be skipped
// - verify output
// - run it

let debug = false || process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const errors = fs.readFileSync('./noUncheckedIndexAccess.txt', 'utf8').split('\n');

const ERROR_REGEXP =
  /(?<path>.*)\((?<line>\d+),(?<column>\d+).*(?<id>TS\d+)\:\s(?<message>.*)/gm;

interface TSParsedError {
  column: number;
  id: string;
  line: number;
  message: string;
  path: string;
}

function parseError(error: string): TSParsedError | null {
  const match = ERROR_REGEXP.exec(error);
  if (!match?.groups) return null;
  return {
    column: Number(match.groups.column),
    id: match.groups.id!,
    line: Number(match.groups.line),
    message: match.groups.message!,
    path: match.groups.path!,
  };
}

function parseErrors(input: string[]): TSParsedError[] {
  const parsedErrors: TSParsedError[] = [];
  for (let i = 0; i < input.length; i++) {
    const error = parseError(input[i]!);
    if (!error) {
      // eslint-disable-next-line no-console
      if (debug) console.warn(`Error parsing error ${i}: ${input[i]}`);
      continue;
    }
    parsedErrors.push(error);
  }
  return parsedErrors;
}

function groupByFile(input: TSParsedError[]): Record<string, TSParsedError[]> {
  const map: Record<string, TSParsedError[]> = {};
  for (const error of input) {
    if (!map[error.path]) map[error.path] = [];
    map[error.path]!.push(error);
  }
  return map;
}

const parsedErrors = parseErrors(errors);
const groupedByFileErrors = groupByFile(parsedErrors);

let ranges: Record<string, {end: number; lines: number[]; start: number}[]> = {};

for (const path in groupedByFileErrors) {
  for (let i = 0; i < groupedByFileErrors[path].length; i++) {
    let lines: number[] = [groupedByFileErrors[path][i].line];
    let rp = i;

    while (
      rp < groupedByFileErrors[path].length &&
      groupedByFileErrors[path][rp + 1]?.message === groupedByFileErrors[path][i].message
    ) {
      lines.push(groupedByFileErrors[path][rp + 1].line);
      rp++;
    }
    ranges[path] = ranges[path] || [];
    ranges[path]!.push({
      start: groupedByFileErrors[path][i].line,
      end: groupedByFileErrors[path][rp].line,
      lines,
    });
    i = rp;
  }
}

let single = 0;
let multiple = 0;
for (const file of Object.keys(ranges)) {
  if (ranges[file].length === 1 && ranges[file][0].lines.length === 1) {
    single++;
  } else {
    multiple++;
  }
}

// const tsconfig = require('./tsconfig.json');
// let program = ts.createProgram(fileNames, tsconfig);
// let checker = program.getTypeChecker();

console.log(`
  ${Object.keys(groupedByFileErrors).length} files
  ${parsedErrors.length} errors, ~${Math.round(parsedErrors.length / Object.keys(groupedByFileErrors).length)} errors per file
  ${single} single, ~${multiple} multiple
`);

function waitForYesNo() {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  return new Promise(resolve => {
    const handler = (str, key) => {
      process.stdin.setRawMode(false);
      const answer = str.toLowerCase();

      if ((key.ctrl && key.name === 'c') || key.name === 'q' || key.name === 'd') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', handler);
        process.exit();
      }

      if (answer === 'y' || answer === 'n') {
        resolve(answer === 'y');
      } else {
        resolve(waitForYesNo());
      }
    };

    process.stdin.on('keypress', handler);
  });
}

const makePrompt = (line: number[]) => {
  return `
  There are ${line.length} errors in this file, specifically on lines ${line.join(', ')}.
  The errors are due to noUncheckedIndexAccess typescript compiler option, your task is to fix these errors.

  There are only two ways that you are allowed to fix this:
    1. Add a type assertion to the index access via non nullable ! operator whenever we are dealing with direct index access
    2. If the error is due to a property access on a variable that is possibly undefined as a result of index access, then you must add a type assertion to the array index access at variable declaration.

  You are not allowed to change the control flow or modify the runtime of the code.
  `;
};

(async () => {
  for (const file of Object.keys(ranges)) {
    for (const instances of ranges[file]) {
      cp.execSync(`echo "${makePrompt(instances.lines)}" | pbcopy`);
      cp.spawn('cursor', [`./${file}`]);
      await waitForYesNo();
    }
  }
})();
