import {existsSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import {oxlintIgnorePatterns} from '../oxlint.config.ts';
import {
  createUnnecessaryTypeAnnotationFinder,
  removeUnnecessaryTypeAnnotations,
  type UnnecessaryTypeAnnotation,
} from '../static/eslint/eslintPluginSentry/unnecessaryTypeAnnotation.ts';

const ruleId = '@sentry/no-unnecessary-type-annotation';
const message = 'Type annotation is unnecessary — TypeScript infers the same type.';
const disableComment = 'sentry-lint-disable-next-line no-unnecessary-type-annotation';
const repositoryRoot = path.resolve(import.meta.dirname, '..');
const projectConfigPaths = [
  'tsconfig.json',
  'static/app/serviceWorker/worker/tsconfig.json',
];

function loadProject(relativeConfigPath: string): ts.ParsedCommandLine {
  const configPath = path.join(repositoryRoot, relativeConfigPath);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  }

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath
  );
  if (parsed.errors.length) {
    throw new Error(
      parsed.errors
        .map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
        .join('\n')
    );
  }

  return parsed;
}

function isTypeScriptSource(fileName: string): boolean {
  return /\.(?:cts|mts|tsx?)$/u.test(fileName) && !/\.d\.[cm]?ts$/u.test(fileName);
}

function isIgnoredByOxlint(fileName: string): boolean {
  const relativeFileName = path
    .relative(repositoryRoot, fileName)
    .replaceAll(path.sep, '/');
  let ignored = false;

  for (const pattern of oxlintIgnorePatterns) {
    const negated = pattern.startsWith('!');
    if (path.matchesGlob(relativeFileName, negated ? pattern.slice(1) : pattern)) {
      ignored = !negated;
    }
  }

  return ignored;
}

function resolveInputPaths(inputPaths: string[]): string[] {
  return inputPaths.map(inputPath => {
    const absolutePath = path.resolve(repositoryRoot, inputPath);
    return existsSync(absolutePath) && statSync(absolutePath).isDirectory()
      ? `${absolutePath}${path.sep}`
      : absolutePath;
  });
}

function isSelected(fileName: string, inputPaths: string[]): boolean {
  if (!inputPaths.length) {
    return true;
  }

  const absoluteFileName = path.resolve(fileName);
  return inputPaths.some(inputPath =>
    inputPath.endsWith(path.sep)
      ? absoluteFileName.startsWith(inputPath)
      : absoluteFileName === inputPath
  );
}

function hasDisableComment(
  sourceFile: ts.SourceFile,
  declaration: UnnecessaryTypeAnnotation
): boolean {
  const {line} = sourceFile.getLineAndCharacterOfPosition(
    declaration.getStart(sourceFile)
  );
  if (line === 0) {
    return false;
  }

  const lineStarts = sourceFile.getLineStarts();
  return sourceFile.text
    .slice(lineStarts[line - 1], lineStarts[line])
    .includes(disableComment);
}

function formatFinding(
  sourceFile: ts.SourceFile,
  declaration: UnnecessaryTypeAnnotation
): string {
  const {line, character} = sourceFile.getLineAndCharacterOfPosition(
    declaration.type.getStart(sourceFile)
  );
  const relativeFileName = path.relative(repositoryRoot, sourceFile.fileName);
  return `${relativeFileName}:${line + 1}:${character + 1}: error: ${message} [${ruleId}]`;
}

function lint({fix, inputPaths}: {fix: boolean; inputPaths: string[]}): number {
  const selectedPaths = resolveInputPaths(inputPaths);
  const findings: Array<{
    declaration: UnnecessaryTypeAnnotation;
    sourceFile: ts.SourceFile;
  }> = [];

  for (const configPath of projectConfigPaths) {
    const project = loadProject(configPath);
    const selectedFiles = project.fileNames.filter(
      fileName =>
        isTypeScriptSource(fileName) &&
        !isIgnoredByOxlint(fileName) &&
        isSelected(fileName, selectedPaths)
    );
    if (!selectedFiles.length) {
      continue;
    }

    const program = ts.createProgram({
      rootNames: project.fileNames,
      options: project.options,
      projectReferences: project.projectReferences,
    });
    const findUnnecessaryTypeAnnotations = createUnnecessaryTypeAnnotationFinder(
      program.getTypeChecker()
    );

    for (const fileName of selectedFiles) {
      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) {
        continue;
      }

      const declarations = findUnnecessaryTypeAnnotations(sourceFile).filter(
        declaration => !hasDisableComment(sourceFile, declaration)
      );
      if (fix) {
        if (declarations.length) {
          writeFileSync(
            sourceFile.fileName,
            removeUnnecessaryTypeAnnotations(sourceFile, declarations)
          );
        }
      } else {
        findings.push(...declarations.map(declaration => ({declaration, sourceFile})));
      }
    }
  }

  for (const {declaration, sourceFile} of findings) {
    console.error(formatFinding(sourceFile, declaration));
  }
  if (findings.length) {
    console.error(`\nFound ${findings.length} Sentry type-annotation error(s).`);
    return 1;
  }
  return 0;
}

const args = process.argv.slice(2);

try {
  process.exitCode = lint({
    fix: args.includes('--fix'),
    inputPaths: args.filter(argument => argument !== '--fix'),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
