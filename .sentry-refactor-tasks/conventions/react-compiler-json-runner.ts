#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

interface OxlintDiagnostic {
  filename: string;
  labels: Array<{
    span?: {
      line: number;
      offset: number;
    };
    label?: string;
  }>;
  message: string;
  help?: string;
}

interface OxlintOutput {
  diagnostics: OxlintDiagnostic[];
}

interface ScannerMessage {
  endLine: number;
  line: number;
  message: string;
  ruleId: string;
}

interface ScannerFile {
  filePath: string;
  messages: ScannerMessage[];
}

const repoPath = process.argv[2];
const category = process.argv[3];
const excludedCategories = (process.argv[4] ?? '').split(',').filter(Boolean);
const scanPaths = process.argv.slice(5);

if (!repoPath || !category || scanPaths.length === 0) {
  console.error(
    'Usage: react-compiler-json-runner <repo-path> <category> <exclude-category,...> <path...>'
  );
  process.exit(1);
}

const result = spawnSync(
  'pnpm',
  [
    'dlx',
    'oxlint@1.70.0',
    '-A',
    'all',
    '-D',
    'react/react-compiler',
    '--react-plugin',
    '--format',
    'json',
    ...scanPaths,
  ],
  {
    cwd: repoPath,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  }
);

// Oxlint exits 1 when it finds diagnostics. Other exit codes indicate that the
// detector itself failed and must not be mistaken for an empty result.
if (result.status !== 0 && result.status !== 1) {
  process.exit(result.status ?? 1);
}

let output: OxlintOutput;
try {
  output = JSON.parse(result.stdout ?? '') as OxlintOutput;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to parse Oxlint JSON: ${message}`);
  process.exit(1);
}

// The convention scanner should only create application-code tasks. Oxlint's
// own ignore configuration does not cover every test/fixture naming convention.
const ignoredFile =
  /(?:^|\/)(?:__fixtures__|__mocks__|test)(?:\/|$)|\.(?:spec|test)\.[^.]+$/;

// A labeled span points at the actionable expression. Diagnostics without a
// labeled span (primarily analyzer failures) fall back to their first span.
const diagnosticLabel = (diagnostic: OxlintDiagnostic) =>
  diagnostic.labels.find(label => label.label) ?? diagnostic.labels[0];
const diagnosticLine = (diagnostic: OxlintDiagnostic) =>
  diagnosticLabel(diagnostic)?.span?.line ?? 1;

// Oxlint currently reports some impure calls in deferred callbacks as if they
// ran during render. Parse each affected file once so those false positives can
// be removed without weakening the other React Compiler categories.
const sourceFiles = new Map<string, ts.SourceFile>();
const deferredCallbacks = new Set([
  'addEventListener',
  'catch',
  'debounce',
  'finally',
  'queueMicrotask',
  'requestAnimationFrame',
  'setInterval',
  'setTimeout',
  'subscribe',
  'then',
  'throttle',
  'useEffect',
  'useInsertionEffect',
  'useLayoutEffect',
]);

function isDeferredPurityDiagnostic(diagnostic: OxlintDiagnostic): boolean {
  const offset = diagnosticLabel(diagnostic)?.span?.offset;
  if (offset === undefined) {
    return false;
  }

  const filePath = path.resolve(repoPath, diagnostic.filename);
  let sourceFile = sourceFiles.get(filePath);
  if (!sourceFile) {
    const source = readFileSync(filePath, 'utf8');
    sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    sourceFiles.set(filePath, sourceFile);
  }

  // Oxlint spans use UTF-8 byte offsets, while TypeScript nodes use UTF-16
  // string offsets. Convert before locating the innermost containing node.
  const sourceOffset = Buffer.from(sourceFile.text, 'utf8')
    .subarray(0, offset)
    .toString('utf8').length;
  let nodeAtOffset: ts.Node = sourceFile;
  function findNode(node: ts.Node) {
    if (node.pos <= sourceOffset && sourceOffset < node.end) {
      nodeAtOffset = node;
      ts.forEachChild(node, findNode);
    }
  }
  findNode(sourceFile);

  for (let node: ts.Node | undefined = nodeAtOffset; node; node = node.parent) {
    if (!ts.isFunctionLike(node)) {
      continue;
    }

    const parent = node.parent;

    // Event handlers may be declared as variables/functions, object methods,
    // callback properties, or inline JSX attributes.
    let callbackName: string | undefined;
    if (ts.isPropertyAssignment(parent) || ts.isVariableDeclaration(parent)) {
      callbackName = parent.name.getText(sourceFile);
    } else if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) {
      callbackName = node.name?.getText(sourceFile);
    } else if (ts.isJsxAttribute(parent)) {
      callbackName = parent.name.getText(sourceFile);
    }
    if (callbackName && /^(?:handle|on)[A-Z]/.test(callbackName)) {
      return true;
    }

    // Also recognize anonymous callbacks passed to APIs that invoke them after
    // render. useMemo is intentionally absent because its callback runs during
    // render; useCallback is absent because calling the returned function during
    // render is still a purity violation.
    if (ts.isCallExpression(parent) && parent.arguments.includes(node as ts.Expression)) {
      const callbackOwner = parent.expression.getText(sourceFile).split('.').at(-1);
      if (callbackOwner && deferredCallbacks.has(callbackOwner)) {
        return true;
      }
    }
  }

  return false;
}

const locationKey = (filePath: string, line: number | undefined) =>
  `${path.resolve(repoPath, filePath)}:${line}`;
const excludedLocations = new Set(
  output.diagnostics
    .filter(diagnostic => excludedCategories.includes(diagnostic.message.split(':')[0]!))
    .map(diagnostic => locationKey(diagnostic.filename, diagnosticLine(diagnostic)))
);

const excludedFindingsPath = process.env.REACT_COMPILER_EXCLUDE_FINDINGS;
let excludedFindings: ScannerFile[] = [];
if (excludedFindingsPath) {
  excludedFindings = JSON.parse(
    readFileSync(excludedFindingsPath, 'utf8')
  ) as ScannerFile[];
  for (const file of excludedFindings) {
    for (const message of file.messages) {
      excludedLocations.add(locationKey(file.filePath, message.line));
    }
  }
}

const diagnostics = output.diagnostics.filter(diagnostic => {
  const messageCategory = diagnostic.message.split(':')[0];
  const line = diagnosticLine(diagnostic);
  return (
    messageCategory === category &&
    !ignoredFile.test(diagnostic.filename) &&
    !excludedLocations.has(locationKey(diagnostic.filename, line)) &&
    !(category === 'Purity' && isDeferredPurityDiagnostic(diagnostic))
  );
});

const files = new Map<string, ScannerMessage[]>();
for (const diagnostic of diagnostics) {
  const line = diagnosticLine(diagnostic);
  const message = [diagnostic.message, diagnostic.help].filter(Boolean).join('\n\n');
  const filePath = path.resolve(repoPath, diagnostic.filename);
  const messages = files.get(filePath) ?? [];

  messages.push({
    ruleId: 'react/react-compiler',
    message,
    line,
    endLine: line,
  });
  files.set(filePath, messages);
}

if (process.env.REACT_COMPILER_INCLUDE_EXCLUDED_FINDINGS) {
  for (const file of excludedFindings) {
    const filePath = path.resolve(repoPath, file.filePath);
    files.set(filePath, [...(files.get(filePath) ?? []), ...file.messages]);
  }
}

console.log(
  JSON.stringify([...files].map(([filePath, messages]) => ({filePath, messages})))
);
