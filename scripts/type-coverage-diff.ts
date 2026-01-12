#!/usr/bin/env node
'use strict';

import {exec} from 'node:child_process';
import fs from 'node:fs';
import {promisify} from 'node:util';

const execAsync = promisify(exec);

type GitDiffChange = {
  addedLines: Set<number>;
  file: string;
  modifiedRanges: Array<{end: number; start: number}>;
  removedLines: Set<number>;
};

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
};

type TypeCoverageResult = {
  files: Array<{
    coverage: number;
    file: string;
    total: number;
    typed: number;
  }>;
  summary: {
    coverage: number;
    filesScanned: number;
    total: number;
    typed: number;
  };
  anySymbols?: Array<{
    column: number;
    file: string;
    kind: string;
    line: number;
    name: string;
  }>;
  nonNullAssertions?: Array<{
    code: string;
    column: number;
    file: string;
    kind: string;
    line: number;
  }>;
  typeAssertions?: Array<{
    code: string;
    column: number;
    file: string;
    kind: string;
    line: number;
    targetType: string;
  }>;
};

type Options = {
  commit?: string;
  daysAgo?: number;
  ignoreFiles?: string[];
  outputFile?: string;
  verbose?: boolean;
};

function showHelp() {
  console.log(`
${colors.bold('Type Coverage Diff')} - Compare TypeScript type coverage between commits

${colors.bold('USAGE:')}
  pnpm run type-coverage-diff [OPTIONS]

${colors.bold('OPTIONS:')}
  --days-ago <number>        Compare with commit from N days ago (default: 5)
  --commit, -c <sha>         Compare with specific commit SHA
  --output, -o <file>        Save detailed JSON report to file
  --verbose, -v              Show verbose output with commit info
  --ignore-files <pattern>   Additional glob patterns to ignore (can be used multiple times)
  --help, -h                 Show this help message

${colors.bold('EXAMPLES:')}
  pnpm run type-coverage-diff
  pnpm run type-coverage-diff --days-ago 7
  pnpm run type-coverage-diff --commit abc1234
  pnpm run type-coverage-diff --commit HEAD~5 --verbose
  pnpm run type-coverage-diff --days-ago 7 --output weekly-report.json

${colors.bold('DESCRIPTION:')}
  This tool compares TypeScript type coverage between two commits and shows:
  - NEW any-typed symbols on lines that were added
  - REMOVED any-typed symbols on lines that were removed
  - NEW/REMOVED non-null assertions and type assertions

  Only shows changes on lines that were literally added or removed in the git diff,
  eliminating false positives from code that just moved around.
`);
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (arg === '--days-ago') {
      opts.daysAgo = Number(args[++i]);
    } else if (arg === '--commit' || arg === '-c') {
      opts.commit = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      opts.outputFile = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      opts.verbose = true;
    } else if (arg === '--ignore-files') {
      if (!opts.ignoreFiles) opts.ignoreFiles = [];
      opts.ignoreFiles.push(args[++i]!);
    } else {
      console.error(colors.red(`Unknown option: ${arg}`));
      console.error('Use --help for usage information');
      process.exit(1);
    }
  }

  return opts;
}

function createIgnoreFilesArgs(ignoreFiles?: string[]): string {
  const defaultIgnoreFiles = [
    '**/*.spec*',
    '**/*stories*',
    '**/fixtures/**',
    '**/__mocks__/**',
    'scripts/**',
    '*.config.ts',
    'config/**',
    'tests/**',
  ];

  const allIgnoreFiles = [...defaultIgnoreFiles, ...(ignoreFiles || [])];
  return allIgnoreFiles.map(pattern => `--ignore-files "${pattern}"`).join(' ');
}

async function getCommitFromDaysAgo(daysAgo: number): Promise<string> {
  try {
    const {stdout} = await execAsync(
      `git log --since="${daysAgo} days ago" --format="%H" | tail -1`,
      {maxBuffer: 1024 * 1024}
    );
    const commit = stdout.trim();
    if (!commit) {
      throw new Error(`No commits found from ${daysAgo} days ago`);
    }
    return commit;
  } catch (error) {
    throw new Error(`Failed to get commit from ${daysAgo} days ago: ${error}`);
  }
}

async function runTypeCoverage(ignoreFilesArgs: string): Promise<TypeCoverageResult> {
  const command = `pnpm run type-coverage --list-any --list-nonnull --list-type-assertions ${ignoreFilesArgs} --detail --json`;

  try {
    const {stdout} = await execAsync(command, {maxBuffer: 1024 * 1024 * 10}); // 10MB buffer
    // Parse JSON from stdout, ignoring any npm/pnpm output
    const jsonStart = stdout.indexOf('{');
    if (jsonStart === -1) {
      throw new Error('No JSON output found from type-coverage command');
    }
    const jsonOutput = stdout.substring(jsonStart);
    return JSON.parse(jsonOutput);
  } catch (error) {
    throw new Error(`Failed to run type-coverage: ${error}`);
  }
}

async function getCurrentRef(): Promise<{isDetached: boolean; ref: string}> {
  try {
    // Get symbolic ref (branch name or 'HEAD' if detached)
    const {stdout: symbolicRef} = await execAsync('git rev-parse --abbrev-ref HEAD');
    const ref = symbolicRef.trim();
    const isDetached = ref === 'HEAD';

    if (isDetached) {
      // In detached HEAD state, get the commit SHA
      const {stdout: commitSha} = await execAsync('git rev-parse HEAD');
      return {ref: commitSha.trim(), isDetached: true};
    }

    return {ref, isDetached: false};
  } catch (error) {
    throw new Error(`Failed to get current ref: ${error}`);
  }
}

async function parseGitDiff(
  oldCommit: string,
  currentCommit: string
): Promise<Map<string, GitDiffChange>> {
  try {
    // Get unified diff with line numbers and context
    const {stdout} = await execAsync(
      `git diff --unified=3 ${oldCommit}..${currentCommit}`,
      {maxBuffer: 1024 * 1024 * 5}
    );

    const changes = new Map<string, GitDiffChange>();
    const lines = stdout.split('\n');
    let currentFile: string | null = null;
    let oldLineNumber = 0;
    let newLineNumber = 0;

    for (const line of lines) {
      // Parse file headers: --- a/file.ts, +++ b/file.ts
      if (line.startsWith('--- a/')) {
        continue; // Skip old file marker
      } else if (line.startsWith('+++ b/')) {
        currentFile = line.substring(6); // Remove "+++ b/"
        if (!changes.has(currentFile)) {
          changes.set(currentFile, {
            file: currentFile,
            addedLines: new Set(),
            removedLines: new Set(),
            modifiedRanges: [],
          });
        }
      } else if (line.startsWith('@@') && currentFile) {
        // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
        if (match) {
          const oldStart = parseInt(match[1] || '1', 10);
          const newStart = parseInt(match[3] || '1', 10);
          const newCount = parseInt(match[4] || '1', 10);
          oldLineNumber = oldStart;
          newLineNumber = newStart;

          const change = changes.get(currentFile)!;
          change.modifiedRanges.push({
            start: newStart,
            end: newStart + newCount - 1,
          });
        }
      } else if (line.startsWith('+') && !line.startsWith('+++') && currentFile) {
        // Added line - exists only in new file
        const change = changes.get(currentFile)!;
        change.addedLines.add(newLineNumber);
        newLineNumber++;
      } else if (line.startsWith('-') && !line.startsWith('---') && currentFile) {
        // Removed line - exists only in old file
        const change = changes.get(currentFile)!;
        change.removedLines.add(oldLineNumber);
        oldLineNumber++;
      } else if (line.startsWith(' ') && currentFile) {
        // Context line (unchanged) - exists in both files
        oldLineNumber++;
        newLineNumber++;
      }
    }

    return changes;
  } catch (error) {
    throw new Error(`Failed to parse git diff: ${error}`);
  }
}

function isOnAddedLine(
  item: {file: string; line: number},
  gitChanges: Map<string, GitDiffChange>
): boolean {
  const change = gitChanges.get(item.file);
  if (!change) {
    return false; // File wasn't modified
  }

  // Check if the line was literally added in the diff
  return change.addedLines.has(item.line);
}

function isOnRemovedLine(
  item: {file: string; line: number},
  gitChanges: Map<string, GitDiffChange>
): boolean {
  const change = gitChanges.get(item.file);
  if (!change) {
    return false; // File wasn't modified
  }

  // Check if the line was literally removed in the diff
  return change.removedLines.has(item.line);
}

function createItemKey(item: any): string {
  return `${item.file}:${item.line}:${item.column}:${item.kind}`;
}

function createSemanticKey(item: {
  column: number;
  file: string;
  kind: string;
  line: number;
}): string {
  // Create a key based on the semantic content, not just location
  if ('name' in item) {
    // For any-typed symbols, use file + kind + name
    return `${item.file}:${item.kind}:${item.name}`;
  }
  if ('code' in item) {
    // For non-null assertions and type assertions, use file + kind + code
    return `${item.file}:${item.kind}:${item.code}`;
  }
  if ('targetType' in item) {
    // For type assertions, include target type
    return `${item.file}:${item.kind}:${item.targetType}`;
  }
  return createItemKey(item);
}

function compareItems<
  T extends {column: number; file: string; kind: string; line: number},
>(
  current: T[],
  old: T[],
  gitChanges: Map<string, GitDiffChange>
): {added: T[]; removed: T[]} {
  // Create semantic maps to match items by their actual content
  const currentSemanticKeys = new Set(current.map(createSemanticKey));
  const oldSemanticKeys = new Set(old.map(createSemanticKey));

  // Only consider items "added" if:
  // 1. They don't exist semantically in the old version, AND
  // 2. They're on lines that were literally added (green + lines in git diff)
  const added = current.filter(
    item =>
      !oldSemanticKeys.has(createSemanticKey(item)) && isOnAddedLine(item, gitChanges)
  );

  // Only consider items "removed" if:
  // 1. They don't exist semantically in the current version, AND
  // 2. They were on lines that were literally removed (red - lines in git diff)
  const removed = old.filter(
    item =>
      !currentSemanticKeys.has(createSemanticKey(item)) &&
      isOnRemovedLine(item, gitChanges)
  );

  return {added, removed};
}

function formatItems<
  T extends {column: number; file: string; kind: string; line: number},
>(
  items: T[],
  title: string,
  color: (text: string) => string,
  formatter?: (item: T) => string
): void {
  if (items.length === 0) return;

  console.log(colors.bold(`\n${title} (${items.length})`));
  console.log('='.repeat(title.length + ` (${items.length})`.length));

  // Sort by file, then by line
  const sortedItems = items.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  for (const item of sortedItems) {
    const location = `${item.file}:${item.line}:${item.column}`;
    const kindPadded = item.kind.padEnd(16);
    const extraInfo = formatter ? formatter(item) : '';
    console.log(`${location}  ${color(kindPadded)}  ${colors.dim(extraInfo)}`);
  }
}

async function main() {
  const opts = parseArgs();

  // Validate that either --days-ago or --commit is provided, but not both
  if (opts.commit && opts.daysAgo) {
    console.error(
      colors.red(
        'Error: Cannot specify both --commit and --days-ago. Please use one or the other.'
      )
    );
    process.exit(1);
  }

  if (!opts.commit && !opts.daysAgo) {
    opts.daysAgo = 5; // Default to 5 days ago
  }

  const ignoreFilesArgs = createIgnoreFilesArgs(opts.ignoreFiles);

  const reportTitle = opts.commit
    ? `Type Coverage Diff Report (${opts.commit.substring(0, 8)} vs current)`
    : `Type Coverage Diff Report (${opts.daysAgo} days ago vs current)`;

  console.log(colors.bold(`${reportTitle}\n`));

  try {
    // Get current ref (branch or commit SHA if detached) and commit info
    const currentRef = await getCurrentRef();

    // Determine the old commit to compare against
    const oldCommit = opts.commit
      ? opts.commit
      : await getCommitFromDaysAgo(opts.daysAgo!);

    // Get current commit SHA
    const {stdout: currentCommitOutput} = await execAsync('git rev-parse HEAD');
    const currentCommit = currentCommitOutput.trim();

    if (opts.verbose) {
      if (currentRef.isDetached) {
        console.log(
          colors.dim(`Current state: detached HEAD at ${currentRef.ref.substring(0, 8)}`)
        );
      } else {
        console.log(colors.dim(`Current branch: ${currentRef.ref}`));
      }
      console.log(colors.dim(`Current commit: ${currentCommit}`));
      console.log(colors.dim(`Comparing against commit: ${oldCommit}\n`));
    }

    // Parse git diff to understand what actually changed
    console.log(colors.dim('Parsing git diff to identify changed areas...'));
    const gitChanges = await parseGitDiff(oldCommit, currentCommit);

    if (opts.verbose) {
      console.log(colors.dim(`Found changes in ${gitChanges.size} files\n`));
    }

    // Run type-coverage on current code
    console.log(colors.dim('Analyzing current code...'));
    const currentResult = await runTypeCoverage(ignoreFilesArgs);

    // Checkout old commit and run type-coverage
    const checkoutMessage = opts.commit
      ? `Checking out commit ${oldCommit.substring(0, 8)}...`
      : `Checking out commit from ${opts.daysAgo} days ago...`;
    console.log(colors.dim(checkoutMessage));

    // Track if we stashed changes
    let hasStash = false;

    // Stash any local changes first
    try {
      await execAsync('git stash push -m "temporary stash for type-coverage-diff"');
      hasStash = true;
    } catch (error) {
      // Ignore if no changes to stash
    }

    // Use try-finally to ensure we always restore the original state
    let oldResult: TypeCoverageResult;
    try {
      await execAsync(`git checkout ${oldCommit}`);

      console.log(colors.dim('Analyzing old code...'));
      oldResult = await runTypeCoverage(ignoreFilesArgs);
    } finally {
      // Always restore the original state, even if an error occurred
      console.log(colors.dim('Restoring original state...'));
      await execAsync(`git checkout ${currentRef.ref}`);

      // Pop stash if we stashed anything
      if (hasStash) {
        try {
          await execAsync('git stash pop');
        } catch (error) {
          console.warn(
            colors.yellow(
              'Warning: Failed to restore stashed changes. Run `git stash pop` manually.'
            )
          );
        }
      }
    }

    // Compare results
    console.log(colors.bold('\n📊 Summary Comparison'));
    console.log('====================');
    console.log(
      `Files scanned: ${colors.cyan(oldResult.summary.filesScanned.toString())} → ${colors.cyan(currentResult.summary.filesScanned.toString())} (${currentResult.summary.filesScanned > oldResult.summary.filesScanned ? colors.green('+') : colors.red('')}${currentResult.summary.filesScanned - oldResult.summary.filesScanned})`
    );
    console.log(
      `Items total  : ${colors.cyan(oldResult.summary.total.toString())} → ${colors.cyan(currentResult.summary.total.toString())} (${currentResult.summary.total > oldResult.summary.total ? colors.green('+') : colors.red('')}${currentResult.summary.total - oldResult.summary.total})`
    );
    console.log(
      `Items typed  : ${colors.cyan(oldResult.summary.typed.toString())} → ${colors.cyan(currentResult.summary.typed.toString())} (${currentResult.summary.typed > oldResult.summary.typed ? colors.green('+') : colors.red('')}${currentResult.summary.typed - oldResult.summary.typed})`
    );
    console.log(
      `Coverage     : ${colors.cyan(oldResult.summary.coverage.toFixed(2) + '%')} → ${colors.cyan(currentResult.summary.coverage.toFixed(2) + '%')} (${currentResult.summary.coverage > oldResult.summary.coverage ? colors.green('+') : colors.red('')}${(currentResult.summary.coverage - oldResult.summary.coverage).toFixed(2)}%)`
    );
    console.log(
      `${colors.dim(`\n📝 Note: Only showing type issues on lines that were literally added (+) or removed (-) in git diff`)}`
    );

    // Compare any-typed symbols (only in actually modified code)
    if (currentResult.anySymbols && oldResult.anySymbols) {
      const anyComparison = compareItems(
        currentResult.anySymbols,
        oldResult.anySymbols,
        gitChanges
      );

      formatItems(
        anyComparison.added,
        '🔴 NEW Any-typed symbols (on added lines)',
        colors.red,
        item => item.name
      );

      formatItems(
        anyComparison.removed,
        '🎉 REMOVED Any-typed symbols (on removed lines)',
        colors.green,
        item => item.name
      );
    }

    // Compare non-null assertions (only in actually modified code)
    if (currentResult.nonNullAssertions && oldResult.nonNullAssertions) {
      const nonNullComparison = compareItems(
        currentResult.nonNullAssertions,
        oldResult.nonNullAssertions,
        gitChanges
      );

      formatItems(
        nonNullComparison.added,
        '🟡 NEW Non-null assertions (on added lines)',
        colors.yellow,
        item => item.code
      );

      formatItems(
        nonNullComparison.removed,
        '🎉 REMOVED Non-null assertions (on removed lines)',
        colors.green,
        item => item.code
      );
    }

    // Compare type assertions (only in actually modified code)
    if (currentResult.typeAssertions && oldResult.typeAssertions) {
      const typeAssertionComparison = compareItems(
        currentResult.typeAssertions,
        oldResult.typeAssertions,
        gitChanges
      );

      formatItems(
        typeAssertionComparison.added,
        '🔵 NEW Type assertions (on added lines)',
        colors.cyan,
        item => `${item.targetType} | ${item.code}`
      );

      formatItems(
        typeAssertionComparison.removed,
        '🎉 REMOVED Type assertions (on removed lines)',
        colors.green,
        item => `${item.targetType} | ${item.code}`
      );
    }

    // Save to file if requested
    if (opts.outputFile) {
      const report = {
        meta: {
          daysAgo: opts.daysAgo,
          currentRef: currentRef.ref,
          isDetached: currentRef.isDetached,
          oldCommit,
          timestamp: new Date().toISOString(),
        },
        summaryComparison: {
          old: oldResult.summary,
          current: currentResult.summary,
          diff: {
            filesScanned:
              currentResult.summary.filesScanned - oldResult.summary.filesScanned,
            total: currentResult.summary.total - oldResult.summary.total,
            typed: currentResult.summary.typed - oldResult.summary.typed,
            coverage: currentResult.summary.coverage - oldResult.summary.coverage,
          },
        },
        changes: {
          anySymbols:
            currentResult.anySymbols && oldResult.anySymbols
              ? compareItems(currentResult.anySymbols, oldResult.anySymbols, gitChanges)
              : undefined,
          nonNullAssertions:
            currentResult.nonNullAssertions && oldResult.nonNullAssertions
              ? compareItems(
                  currentResult.nonNullAssertions,
                  oldResult.nonNullAssertions,
                  gitChanges
                )
              : undefined,
          typeAssertions:
            currentResult.typeAssertions && oldResult.typeAssertions
              ? compareItems(
                  currentResult.typeAssertions,
                  oldResult.typeAssertions,
                  gitChanges
                )
              : undefined,
        },
      };

      fs.writeFileSync(opts.outputFile, JSON.stringify(report, null, 2));
      console.log(`\n${colors.dim(`Report saved to: ${opts.outputFile}`)}`);
    }

    console.log('\n' + colors.bold('🎯 Weekly Type Coverage Tracking Complete!'));
  } catch (error) {
    console.error(colors.red(`Error: ${error}`));
    process.exit(1);
  }
}

try {
  main();
} catch (err) {
  console.error(colors.red(String(err)));
  process.exit(1);
}
