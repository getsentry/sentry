import ts from 'typescript';

import {
  createUnnecessaryTypeAnnotationFinder,
  removeUnnecessaryTypeAnnotations,
} from './unnecessaryTypeAnnotation';

const repositoryRoot = ts.sys.resolvePath(`${import.meta.dirname}/../../..`);
const fixtureFileName = `${import.meta.dirname}/unnecessaryTypeAnnotation.fixture.ts`;
const configPath = `${repositoryRoot}/tsconfig.json`;
const project = ts.getParsedCommandLineOfConfigFile(
  configPath,
  {},
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic(diagnostic) {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  }
);

if (!project) {
  throw new Error(`Could not load ${configPath}`);
}

let fixtureCode = '';
let fixtureVersion = 0;
const languageService = ts.createLanguageService({
  getCompilationSettings: () => project.options,
  getCurrentDirectory: () => repositoryRoot,
  getDefaultLibFileName: ts.getDefaultLibFilePath,
  getProjectVersion: () => String(fixtureVersion),
  getScriptFileNames: () => [fixtureFileName],
  getScriptSnapshot(fileName) {
    const source = fileName === fixtureFileName ? fixtureCode : ts.sys.readFile(fileName);
    return source === undefined ? undefined : ts.ScriptSnapshot.fromString(source);
  },
  getScriptVersion: fileName =>
    fileName === fixtureFileName ? String(fixtureVersion) : '0',
  fileExists: fileName => fileName === fixtureFileName || ts.sys.fileExists(fileName),
  readFile: fileName =>
    fileName === fixtureFileName ? fixtureCode : ts.sys.readFile(fileName),
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
  realpath: ts.sys.realpath,
});

afterAll(() => languageService.dispose());

function lint(code: string) {
  fixtureCode = code;
  fixtureVersion += 1;

  const program = languageService.getProgram();
  const sourceFile = program?.getSourceFile(fixtureFileName);
  if (!program || !sourceFile) {
    throw new Error('Could not create the type-annotation test program');
  }

  const declarations = createUnnecessaryTypeAnnotationFinder(program.getTypeChecker())(
    sourceFile
  );
  return {
    declarations,
    output: removeUnnecessaryTypeAnnotations(sourceFile, declarations),
  };
}

type TestCase = {
  code: string;
  name: string;
};

const validCases: TestCase[] = [
  {
    name: 'no annotation',
    code: 'const x = 5;',
  },
  {
    name: 'wider type than inferred (number vs literal 5)',
    code: 'const x: number = 5;',
  },
  {
    name: 'wider type annotation on const (string vs literal)',
    code: 'const x: string = "hello";',
  },
  {
    name: 'boolean literal widening',
    code: 'const x: boolean = true;',
  },
  {
    name: 'let with wider type (allows reassignment to other values)',
    code: 'let x: string | number = getString();',
  },
  {
    name: 'destructuring (excluded)',
    code: 'const {a}: {a: string} = obj;',
  },
  {
    name: 'any annotation (escape hatch)',
    code: 'const x: any = getValue();',
  },
  {
    name: 'unknown annotation (escape hatch)',
    code: 'const x: unknown = getValue();',
  },
  {
    name: 'empty array literal (excluded)',
    code: 'const arr: string[] = [];',
  },
  {
    name: 'non-empty array literal (excluded)',
    code: 'const arr: number[] = [1, 2, 3];',
  },
  {
    name: 'empty object literal (excluded)',
    code: 'const obj: Record<string, number[]> = {};',
  },
  {
    name: 'non-empty object literal (excluded)',
    code: 'const obj: { a: number } = { a: 1 };',
  },
  {
    name: 'arrow function (annotation provides contextual parameter types)',
    code: `
        import {FocusEventHandler} from "react";
        const handleBlur: FocusEventHandler<HTMLInputElement> = e => {};
      `,
  },
  {
    name: 'function expression (annotation provides contextual parameter types)',
    code: 'const fn: (x: number) => number = function(x) { return x; };',
  },
  {
    name: 'nested arrow function with untyped parameter (annotation provides contextual parameter types)',
    code: `
        declare function TrackingContextProvider(props: {
          value: () => (props: {eventName?: string}) => void;
        }): React.ReactNode;
        const tracking: React.ComponentProps<typeof TrackingContextProvider>['value'] =
          () => props => {};
      `,
  },
  {
    name: 'call expression with untyped callback (contextual typing flows through generic)',
    code: `
        declare function useCallback<T>(fn: T): T;
        type Reducer = (state: number, action: string) => number;
        const reducer: Reducer = useCallback((state, action) => state, []);
      `,
  },
  {
    name: 'ternary with untyped arrow function in alternate branch',
    code: `
        declare function typed(): (x: number) => number;
        const fn: (x: number) => number = true ? typed() : x => x;
      `,
  },
  {
    name: 'ternary with untyped arrow function in consequent branch',
    code: `
        declare function typed(): (x: number) => number;
        const fn: (x: number) => number = true ? x => x : typed();
      `,
  },
  {
    name: 'logical OR with untyped arrow function',
    code: `
        declare const maybeFn: ((x: number) => number) | null;
        const fn: (x: number) => number = maybeFn || (x => x);
      `,
  },
  {
    name: 'function returning any — annotation narrows the type',
    code: `
        declare function getAny(): any;
        const x: string = getAny();
      `,
  },
  {
    name: 'function returning Promise<any> — annotation narrows the type argument',
    code: `
        declare function getPromise(): Promise<any>;
        const p: Promise<string> = getPromise();
      `,
  },
  {
    name: 'nested any in type arguments (e.g. Array<any>)',
    code: `
        declare function getArr(): Array<any>;
        const a: Array<number> = getArr();
      `,
  },
  {
    name: 'annotation adds index signature — Record<string, T> vs {}',
    code: `
        type TagCollection = Record<string, { key: string }>;
        declare function getObj(): {};
        const x: TagCollection = getObj();
      `,
  },
  {
    name: 'annotation widens with optional properties',
    code: `
        type Base = { a: string };
        type Extended = Base & { extra?: number };
        declare function getBase(): Base;
        const x: Extended = getBase();
      `,
  },
  {
    name: 'let with generic type parameter — annotation widens from generic',
    code: `
        function example<T extends string>(value: T) {
          let url: string = value;
          return url;
        }
      `,
  },
  {
    name: 'const with generic type parameter — annotation widens from generic',
    code: `
        function example<T extends string>(value: T) {
          const url: string = value;
          return url;
        }
      `,
  },
];

const invalidCases: Array<TestCase & {output: string}> = [
  {
    name: 'const with redundant string annotation',
    code: `
        function getString(): string { return ""; }
        const s: string = getString();
      `,
    output: `
        function getString(): string { return ""; }
        const s = getString();
      `,
  },
  {
    name: 'const with redundant number annotation',
    code: `
        function getNumber(): number { return 0; }
        const n: number = getNumber();
      `,
    output: `
        function getNumber(): number { return 0; }
        const n = getNumber();
      `,
  },
  {
    name: 'let with redundant annotation from function return',
    code: `
        declare function getString(): string;
        let s: string = getString();
      `,
    output: `
        declare function getString(): string;
        let s = getString();
      `,
  },
  {
    name: 'let with literal that TypeScript already widens',
    code: "let x: string = '';",
    output: "let x = '';",
  },
  {
    name: 'unnecessary annotation despite unrelated untyped helper in function body',
    code: `
        const fn: (x: number) => number = (x: number) => {
          const helper = y => y;
          return x;
        };
      `,
    output: `
        const fn = (x: number) => {
          const helper = y => y;
          return x;
        };
      `,
  },
];

describe('unnecessary type annotations', () => {
  it.each(validCases)('$name', ({code}) => {
    expect(lint(code).declarations).toHaveLength(0);
  });

  it.each(invalidCases)('$name', ({code, output}) => {
    const result = lint(code);
    expect(result.declarations).toHaveLength(1);
    expect(result.output).toBe(output);
  });
});
