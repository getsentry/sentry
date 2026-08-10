import {existsSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

import ts from 'typescript';

import {createTypeAwareRuleChecks} from '../static/eslint/eslintPluginSentry/typeAwareRules.ts';

const unnecessaryTypeAnnotationRuleId = '@sentry/no-unnecessary-type-annotation';
const unnecessaryTypeNarrowingRuleId = '@sentry/no-unnecessary-type-narrowing';

type TypeAwareFinding = {
  end: number;
  message: string;
  node: ts.Node;
  ruleId: typeof unnecessaryTypeAnnotationRuleId | typeof unnecessaryTypeNarrowingRuleId;
  start: number;
};

type TypeAwareRuleChecks = ReturnType<typeof createTypeAwareRuleChecks>;

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const projectConfigPaths = [
  path.join(repositoryRoot, 'tsconfig.json'),
  path.join(repositoryRoot, 'static/app/serviceWorker/worker/tsconfig.json'),
];

const optionsWithValues = new Set([
  '-A',
  '-D',
  '-W',
  '-c',
  '-f',
  '--allow',
  '--config',
  '--debug',
  '--deny',
  '--format',
  '--ignore-path',
  '--ignore-pattern',
  '--max-warnings',
  '--report-unused-disable-directives-severity',
  '--threads',
  '--tsconfig',
  '--warn',
]);

type Project = {
  parsed: ts.ParsedCommandLine;
};

function extractSelectors(args: string[]): string[] {
  const selectors: string[] = [];
  let skipNext = false;

  for (const argument of args) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (optionsWithValues.has(argument)) {
      skipNext = true;
      continue;
    }
    if (argument === '--' || argument.startsWith('-')) {
      continue;
    }
    selectors.push(argument);
  }

  return selectors;
}

function loadProject(configPath: string): Project {
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

  return {parsed};
}

function hasTypeScriptExtension(fileName: string): boolean {
  return /\.(?:cts|mts|tsx?)$/u.test(fileName) && !/\.d\.[cm]?ts$/u.test(fileName);
}

function isIgnored(relativeFileName: string): boolean {
  const fileName = relativeFileName.replaceAll(path.sep, '/');
  const segments = fileName.split('/');

  if (
    segments.some(segment =>
      [
        '.agents',
        '.artifacts',
        '.devenv',
        '.github',
        '.mypy_cache',
        '.pytest_cache',
        '.sentry-refactor-tasks',
        '.venv',
        'dist',
        'node_modules',
        'vendor',
      ].includes(segment)
    ) ||
    fileName.startsWith('api-docs/') ||
    fileName.startsWith('build-utils/') ||
    fileName.startsWith('fixtures/artifact_bundle/') ||
    fileName.startsWith('fixtures/artifact_bundle_debug_ids/') ||
    fileName.startsWith('fixtures/artifact_bundle_duplicated_debug_ids/') ||
    fileName.startsWith('src/sentry/static/sentry/js/') ||
    fileName.startsWith('src/sentry/templates/sentry/') ||
    (fileName.startsWith('tests/') &&
      fileName.includes('/fixtures/') &&
      !fileName.startsWith('tests/js/'))
  ) {
    return true;
  }

  return (
    fileName === 'config/chartcuterie/config.js' ||
    fileName === 'jest.config.ts' ||
    fileName === 'jest.config.snapshots.ts' ||
    fileName.endsWith('.figma.tsx') ||
    fileName.endsWith('.mdx')
  );
}

type Selector = {
  absolutePath: string;
  directory: boolean;
};

function normalizeSelectors(selectors: string[]): Selector[] {
  return selectors.map(selector => {
    const absolutePath = path.resolve(repositoryRoot, selector);
    return {
      absolutePath,
      directory: existsSync(absolutePath) && statSync(absolutePath).isDirectory(),
    };
  });
}

function isSelected(fileName: string, selectors: Selector[]): boolean {
  if (!selectors.length) {
    return true;
  }

  const absoluteFileName = path.resolve(fileName);
  return selectors.some(selector =>
    selector.directory
      ? absoluteFileName.startsWith(`${selector.absolutePath}${path.sep}`)
      : absoluteFileName === selector.absolutePath
  );
}

function getLineText(sourceFile: ts.SourceFile, line: number): string {
  const lineStarts = sourceFile.getLineStarts();
  if (line < 0 || line >= lineStarts.length) {
    return '';
  }
  return sourceFile.text.slice(lineStarts[line], lineStarts[line + 1]);
}

function ruleListContains(comment: string, ruleId: string): boolean {
  const rules = comment
    .split(/[,\s]+/u)
    .map(rule => rule.trim())
    .filter(Boolean);
  return rules.includes(ruleId) || rules.includes(ruleId.replace('@sentry/', ''));
}

function isSuppressed(sourceFile: ts.SourceFile, finding: TypeAwareFinding): boolean {
  const {line} = sourceFile.getLineAndCharacterOfPosition(
    finding.node.getStart(sourceFile)
  );
  const previousLine = getLineText(sourceFile, line - 1);
  const currentLine = getLineText(sourceFile, line);
  const nextLineMatch = /sentry-lint-disable-next-line\s+([^\r\n]+)/u.exec(previousLine);
  const sameLineMatch = /sentry-lint-disable-line\s+([^\r\n]+)/u.exec(currentLine);

  return Boolean(
    (nextLineMatch && ruleListContains(nextLineMatch[1]!, finding.ruleId)) ||
    (sameLineMatch && ruleListContains(sameLineMatch[1]!, finding.ruleId))
  );
}

function collectTypeAwareFindings(
  sourceFile: ts.SourceFile,
  checks: TypeAwareRuleChecks
): TypeAwareFinding[] {
  const findings: TypeAwareFinding[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      node.type &&
      ts.isIdentifier(node.name) &&
      checks.isUnnecessaryTypeAnnotation(node)
    ) {
      findings.push({
        ruleId: unnecessaryTypeAnnotationRuleId,
        message: 'Type annotation is unnecessary — TypeScript infers the same type.',
        node: node.type,
        start: node.name.end,
        end: node.type.end,
      });
    }

    if (ts.isAsExpression(node) && checks.isUnnecessaryTypeNarrowing(node)) {
      const assertionText = sourceFile.text.slice(node.expression.end, node.end);
      const asKeyword = /\s+as\b/u.exec(assertionText);
      if (asKeyword) {
        findings.push({
          ruleId: unnecessaryTypeNarrowingRuleId,
          message:
            'Type assertion is unnecessary: the original type is already assignable to the expected type.',
          node: node.type,
          start: node.expression.end + asKeyword.index,
          end: node.end,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function formatFinding(sourceFile: ts.SourceFile, finding: TypeAwareFinding): string {
  const {line, character} = sourceFile.getLineAndCharacterOfPosition(
    finding.node.getStart(sourceFile)
  );
  const relativeFileName = path.relative(repositoryRoot, sourceFile.fileName);
  return `${relativeFileName}:${line + 1}:${character + 1}: error: ${finding.message} [${finding.ruleId}]`;
}

function applyFixes(sourceFile: ts.SourceFile, findings: TypeAwareFinding[]) {
  let boundary = sourceFile.text.length + 1;
  let output = sourceFile.text;
  const unfixed: TypeAwareFinding[] = [];

  for (const finding of findings.toSorted((a, b) => b.start - a.start)) {
    if (finding.end > boundary) {
      unfixed.push(finding);
      continue;
    }
    output = output.slice(0, finding.start) + output.slice(finding.end);
    boundary = finding.start;
  }

  if (output !== sourceFile.text) {
    writeFileSync(sourceFile.fileName, output);
  }
  return unfixed;
}

export function runSentryTypeAwareLint(args: string[]): number {
  const fix = args.includes('--fix');
  const rawSelectors = extractSelectors(args);
  const selectors = normalizeSelectors(rawSelectors);

  if (
    selectors.length > 0 &&
    selectors.every(
      selector => !selector.directory && !hasTypeScriptExtension(selector.absolutePath)
    )
  ) {
    return 0;
  }

  const visitedFiles = new Set<string>();
  const remainingFindings: Array<{finding: TypeAwareFinding; sourceFile: ts.SourceFile}> =
    [];

  for (const configPath of projectConfigPaths) {
    const {parsed} = loadProject(configPath);
    const program = ts.createProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
      projectReferences: parsed.projectReferences,
    });
    const checks = createTypeAwareRuleChecks(program.getTypeChecker());

    for (const sourceFile of program.getSourceFiles()) {
      const absoluteFileName = path.resolve(sourceFile.fileName);
      const relativeFileName = path.relative(repositoryRoot, absoluteFileName);
      if (
        sourceFile.isDeclarationFile ||
        visitedFiles.has(absoluteFileName) ||
        relativeFileName.startsWith(`..${path.sep}`) ||
        !hasTypeScriptExtension(absoluteFileName) ||
        isIgnored(relativeFileName) ||
        !isSelected(absoluteFileName, selectors)
      ) {
        continue;
      }

      visitedFiles.add(absoluteFileName);
      const findings = collectTypeAwareFindings(sourceFile, checks).filter(
        finding => !isSuppressed(sourceFile, finding)
      );
      if (fix) {
        remainingFindings.push(
          ...applyFixes(sourceFile, findings).map(finding => ({finding, sourceFile}))
        );
      } else {
        remainingFindings.push(...findings.map(finding => ({finding, sourceFile})));
      }
    }
  }

  for (const {finding, sourceFile} of remainingFindings) {
    console.error(formatFinding(sourceFile, finding));
  }
  if (remainingFindings.length) {
    console.error(`\nFound ${remainingFindings.length} Sentry type-aware error(s).`);
    return 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    process.exitCode = runSentryTypeAwareLint(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
}
