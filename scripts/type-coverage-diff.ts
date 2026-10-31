#!/usr/bin/env node
'use strict';

import {exec} from 'node:child_process';
import fs from 'node:fs';
import {promisify} from 'node:util';

const execAsync = promisify(exec);

export type CoverageItem = {
  column: number;
  file: string;
  kind: string;
  line: number;
  code?: string;
  name?: string;
  targetType?: string;
};

type EditBlock = {
  addedLines: Set<number>;
  removedLines: Set<number>;
};

export type GitDiffChange = EditBlock & {
  blocks: EditBlock[];
  file: string;
  oldFile: string;
};

export function parseGitDiffText(diff: string): Map<string, GitDiffChange> {
  const changes = new Map<string, GitDiffChange>();
  let oldFile = '';
  let change: GitDiffChange | undefined;
  let block: EditBlock | undefined;
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      change = undefined;
      block = undefined;
      oldFile = '';
      inHunk = false;
    } else if (!inHunk && line.startsWith('--- ')) {
      oldFile = line.startsWith('--- a/') ? line.slice(6) : '';
    } else if (!inHunk && line.startsWith('+++ ')) {
      const file = line.startsWith('+++ b/') ? line.slice(6) : oldFile;
      change = {
        file,
        oldFile: oldFile || file,
        addedLines: new Set(),
        removedLines: new Set(),
        blocks: [],
      };
      changes.set(file, change);
    } else if (line.startsWith('@@ ')) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
        block = undefined;
        inHunk = true;
      }
    } else if (inHunk && change) {
      if (line.startsWith('+') || line.startsWith('-')) {
        if (!block) {
          block = {addedLines: new Set(), removedLines: new Set()};
          change.blocks.push(block);
        }
        if (line.startsWith('+')) {
          change.addedLines.add(newLine);
          block.addedLines.add(newLine++);
        } else {
          change.removedLines.add(oldLine);
          block.removedLines.add(oldLine++);
        }
      } else if (line.startsWith(' ')) {
        oldLine++;
        newLine++;
        block = undefined;
      }
    }
  }
  return changes;
}

function semanticKey(item: CoverageItem): string {
  // Include the target even when the code preview was truncated before the cast.
  return JSON.stringify([item.kind, item.name, item.code, item.targetType]);
}

function assertionKey(item: CoverageItem): string | undefined {
  if (item.kind === 'type(as)' || item.kind === 'type(angle)') {
    return item.targetType === undefined
      ? undefined
      : JSON.stringify([item.kind, item.targetType]);
  }
  if (
    item.kind === 'as-any' ||
    item.kind === 'nonnull(expr)' ||
    item.kind === 'nonnull(property)'
  ) {
    return item.kind;
  }
  return undefined;
}

export function compareItems<T extends CoverageItem>(
  current: T[],
  old: T[],
  gitChanges: Map<string, GitDiffChange>
): {added: T[]; removed: T[]} {
  const oldChanges = new Map(
    Array.from(gitChanges.values(), change => [change.oldFile, change])
  );
  const isAdded = (item: T) =>
    gitChanges.get(item.file)?.addedLines.has(item.line) ?? false;
  const isRemoved = (item: T) =>
    oldChanges.get(item.file)?.removedLines.has(item.line) ?? false;
  const unmatchedCurrent = new Set(current);
  const unmatchedOld = new Set(old);

  function match(currentItems: T[], oldItems: T[], key: (item: T) => string | undefined) {
    const candidates = new Map<string, T[]>();
    for (const item of oldItems) {
      const itemKey = key(item);
      if (itemKey === undefined || !unmatchedOld.has(item)) {
        continue;
      }
      const bucket = candidates.get(itemKey) ?? [];
      bucket.push(item);
      candidates.set(itemKey, bucket);
    }
    for (const item of currentItems) {
      if (!unmatchedCurrent.has(item)) {
        continue;
      }
      const itemKey = key(item);
      if (itemKey === undefined) {
        continue;
      }
      const previous = candidates.get(itemKey)?.shift();
      if (previous) {
        unmatchedCurrent.delete(item);
        unmatchedOld.delete(previous);
      }
    }
  }

  // Reserve unchanged occurrences first, so an added duplicate cannot use them.
  match(
    [...current].sort((a, b) => Number(isAdded(a)) - Number(isAdded(b))),
    [...old].sort((a, b) => Number(isRemoved(a)) - Number(isRemoved(b))),
    item =>
      JSON.stringify([
        // Use the new path when Git identifies a rename.
        oldChanges.get(item.file)?.file ?? item.file,
        semanticKey(item),
      ])
  );

  // Match exact moves across files too, including deleted files and renames.
  match(current.filter(isAdded), old.filter(isRemoved), item =>
    item.code === undefined && item.kind !== 'as-any' ? undefined : semanticKey(item)
  );

  function byFile(items: Set<T>) {
    const files = new Map<string, T[]>();
    for (const item of items) {
      const bucket = files.get(item.file) ?? [];
      bucket.push(item);
      files.set(item.file, bucket);
    }
    return files;
  }
  const currentByFile = byFile(unmatchedCurrent);
  const oldByFile = byFile(unmatchedOld);

  // An operand edit does not introduce another assertion. Limit this heuristic
  // to a contiguous replacement block; do not cancel unrelated edits in a file.
  for (const change of gitChanges.values()) {
    for (const block of change.blocks) {
      match(
        (currentByFile.get(change.file) ?? []).filter(item =>
          block.addedLines.has(item.line)
        ),
        (oldByFile.get(change.oldFile) ?? []).filter(item =>
          block.removedLines.has(item.line)
        ),
        assertionKey
      );
    }
  }

  return {
    added: current.filter(item => unmatchedCurrent.has(item) && isAdded(item)),
    removed: old.filter(item => unmatchedOld.has(item) && isRemoved(item)),
  };
}

const colors = {
  red: (text: string) => `\x1B[31m${text}\x1B[0m`,
  green: (text: string) => `\x1B[32m${text}\x1B[0m`,
  yellow: (text: string) => `\x1B[33m${text}\x1B[0m`,
  cyan: (text: string) => `\x1B[36m${text}\x1B[0m`,
  bold: (text: string) => `\x1B[1m${text}\x1B[0m`,
  dim: (text: string) => `\x1B[2m${text}\x1B[0m`,
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

  Matches existing issues one-to-one before reporting added or removed lines.
  Ignores exact code moves and assertions whose kind and target type are unchanged
  within the same replacement block.
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
      if (!opts.ignoreFiles) {
        opts.ignoreFiles = [];
      }
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
    // Use a large buffer (100MB) to handle diffs against commits that are weeks old
    const {stdout} = await execAsync(
      `git diff --unified=3 ${oldCommit}..${currentCommit}`,
      {maxBuffer: 1024 * 1024 * 100}
    );

    return parseGitDiffText(stdout);
  } catch (error) {
    throw new Error(`Failed to parse git diff: ${error}`);
  }
}

function formatItems<
  T extends {column: number; file: string; kind: string; line: number},
>(
  items: T[],
  title: string,
  color: (text: string) => string,
  formatter?: (item: T) => string
): void {
  if (items.length === 0) {
    return;
  }

  console.log(colors.bold(`\n${title} (${items.length})`));
  console.log('='.repeat(title.length + ` (${items.length})`.length));

  // Sort by file, then by line
  const sortedItems = items.sort((a, b) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
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

    // Calculate untyped items
    const oldUntyped = oldResult.summary.total - oldResult.summary.typed;
    const currentUntyped = currentResult.summary.total - currentResult.summary.typed;
    console.log(
      `Items untyped: ${colors.cyan(oldUntyped.toString())} → ${colors.cyan(currentUntyped.toString())} (${currentUntyped <= oldUntyped ? colors.green('') : colors.red('+')}${currentUntyped - oldUntyped})`
    );

    console.log(
      `Coverage     : ${colors.cyan(oldResult.summary.coverage.toFixed(2) + '%')} → ${colors.cyan(currentResult.summary.coverage.toFixed(2) + '%')} (${currentResult.summary.coverage > oldResult.summary.coverage ? colors.green('+') : colors.red('')}${(currentResult.summary.coverage - oldResult.summary.coverage).toFixed(2)}%)`
    );

    // Show counts of type issues
    const oldAnyCount = oldResult.anySymbols?.length ?? 0;
    const currentAnyCount = currentResult.anySymbols?.length ?? 0;
    const oldNonNullCount = oldResult.nonNullAssertions?.length ?? 0;
    const currentNonNullCount = currentResult.nonNullAssertions?.length ?? 0;
    const oldTypeAssertCount = oldResult.typeAssertions?.length ?? 0;
    const currentTypeAssertCount = currentResult.typeAssertions?.length ?? 0;

    console.log(
      `Any symbols  : ${colors.cyan(oldAnyCount.toString())} → ${colors.cyan(currentAnyCount.toString())} (${currentAnyCount <= oldAnyCount ? colors.green('') : colors.red('+')}${currentAnyCount - oldAnyCount})`
    );
    console.log(
      `Non-null (!) : ${colors.cyan(oldNonNullCount.toString())} → ${colors.cyan(currentNonNullCount.toString())} (${currentNonNullCount <= oldNonNullCount ? colors.green('') : colors.red('+')}${currentNonNullCount - oldNonNullCount})`
    );
    console.log(
      `Type asserts : ${colors.cyan(oldTypeAssertCount.toString())} → ${colors.cyan(currentTypeAssertCount.toString())} (${currentTypeAssertCount <= oldTypeAssertCount ? colors.green('') : colors.red('+')}${currentTypeAssertCount - oldTypeAssertCount})`
    );

    console.log(
      colors.dim(
        '\n📝 Note: Only showing type issues on lines that were literally added (+) or removed (-) in git diff'
      )
    );

    // Compare any-typed symbols (only in actually modified code)
    if (currentResult.anySymbols || oldResult.anySymbols) {
      const anyComparison = compareItems(
        currentResult.anySymbols ?? [],
        oldResult.anySymbols ?? [],
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
    if (currentResult.nonNullAssertions || oldResult.nonNullAssertions) {
      const nonNullComparison = compareItems(
        currentResult.nonNullAssertions ?? [],
        oldResult.nonNullAssertions ?? [],
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
    if (currentResult.typeAssertions || oldResult.typeAssertions) {
      const typeAssertionComparison = compareItems(
        currentResult.typeAssertions ?? [],
        oldResult.typeAssertions ?? [],
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
            currentResult.anySymbols || oldResult.anySymbols
              ? compareItems(
                  currentResult.anySymbols ?? [],
                  oldResult.anySymbols ?? [],
                  gitChanges
                )
              : undefined,
          nonNullAssertions:
            currentResult.nonNullAssertions || oldResult.nonNullAssertions
              ? compareItems(
                  currentResult.nonNullAssertions ?? [],
                  oldResult.nonNullAssertions ?? [],
                  gitChanges
                )
              : undefined,
          typeAssertions:
            currentResult.typeAssertions || oldResult.typeAssertions
              ? compareItems(
                  currentResult.typeAssertions ?? [],
                  oldResult.typeAssertions ?? [],
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

if (import.meta.main) {
  try {
    await main();
  } catch (err) {
    console.error(colors.red(String(err)));
    process.exit(1);
  }
}
