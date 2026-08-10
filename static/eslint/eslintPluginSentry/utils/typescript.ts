import type {TSESTree} from '@typescript-eslint/utils';
import type {ParserServicesWithTypeInformation} from '@typescript-eslint/utils';
import ts from 'typescript';

type RuleContext = {
  filename: string;
  sourceCode: {
    parserServices?: unknown;
  };
};

type TypeScriptServices = {
  getTsNode(node: TSESTree.Node): ts.Node | undefined;
  program: ts.Program;
};

const standalonePrograms = new Map<string, ts.Program | null>();

function createStandaloneProgram(configPath: string): ts.Program | undefined {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    return undefined;
  }

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    configPath.replace(/[/\\][^/\\]+$/u, ''),
    undefined,
    configPath
  );
  if (parsed.errors.length > 0) {
    return undefined;
  }

  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });
}

function getStandaloneProgram(fileName: string): ts.Program | undefined {
  const fileDirectory = fileName.replace(/[/\\][^/\\]+$/u, '');
  const configPath = ts.findConfigFile(fileDirectory, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    return undefined;
  }

  if (!standalonePrograms.has(configPath)) {
    standalonePrograms.set(configPath, createStandaloneProgram(configPath) ?? null);
  }
  return standalonePrograms.get(configPath) ?? undefined;
}

function findNodeAtRange(
  sourceFile: ts.SourceFile,
  [start, end]: TSESTree.Node['range']
): ts.Node | undefined {
  let bestMatch: ts.Node | undefined;

  function visit(node: ts.Node): void {
    if (node.getStart(sourceFile) > start || node.getEnd() < end) {
      return;
    }

    bestMatch = node;
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return bestMatch;
}

/**
 * Return TypeScript services under both ESLint and Oxlint.
 *
 * ESLint supplies the ESTree-to-TypeScript maps through parser services. Oxlint's
 * JS-plugin API intentionally does not expose type information, so its fallback
 * builds one cached TypeScript Program and maps nodes by their source ranges.
 */
export function getTypeScriptServices(
  context: RuleContext
): TypeScriptServices | undefined {
  const parserServices = context.sourceCode.parserServices as
    | Partial<ParserServicesWithTypeInformation>
    | undefined;
  if (parserServices?.program && parserServices.esTreeNodeToTSNodeMap) {
    return {
      program: parserServices.program,
      getTsNode(node) {
        return parserServices.esTreeNodeToTSNodeMap!.get(node);
      },
    };
  }

  const fileName = ts.sys.resolvePath(context.filename);
  const program = getStandaloneProgram(fileName);
  if (!program) {
    return undefined;
  }

  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    return undefined;
  }

  return {
    program,
    getTsNode(node) {
      return findNodeAtRange(sourceFile, node.range);
    },
  };
}
