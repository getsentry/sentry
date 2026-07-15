#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';

interface OxlintDiagnostic {
  filename: string;
  labels: Array<{
    span?: {
      line: number;
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

const ignoredFile =
  /(?:^|\/)(?:__fixtures__|__mocks__|test)(?:\/|$)|\.(?:spec|test)\.[^.]+$/;
const diagnosticLine = (diagnostic: OxlintDiagnostic) => diagnostic.labels[0]?.span?.line;
const locationKey = (filePath: string, line: number | undefined) =>
  `${path.resolve(repoPath, filePath)}:${line}`;
const excludedLocations = new Set(
  output.diagnostics
    .filter(diagnostic =>
      excludedCategories.includes(diagnostic.message.split(':', 1)[0]!)
    )
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
  const messageCategory = diagnostic.message.split(':', 1)[0];
  const line = diagnosticLine(diagnostic);
  return (
    messageCategory === category &&
    !ignoredFile.test(diagnostic.filename) &&
    !excludedLocations.has(locationKey(diagnostic.filename, line))
  );
});

const files = new Map<string, ScannerMessage[]>();
for (const diagnostic of diagnostics) {
  const primaryLabel =
    diagnostic.labels.find(label => label.label) ?? diagnostic.labels[0];
  const line = primaryLabel?.span?.line ?? 1;
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
