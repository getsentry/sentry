import {execFileSync, spawnSync} from 'node:child_process';
import {appendFileSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const CONFIG_DIR = '.sentry-refactor-tasks';
const CONVENTIONS_DIR = join(CONFIG_DIR, 'conventions');

type LineRange = {end: number; start: number};

export type Finding = {
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  file: string;
  line_end: number;
  line_start: number;
  pattern_name: string;
  severity: 'error' | 'warning' | 'info';
  snippet: string;
};

/**
 * Map each file to the line ranges the patch adds to it, numbered as in the
 * merge commit. Expects `git diff -U0` output, so every hunk line is a change.
 */
export function parseAddedLines(diff: string): Map<string, LineRange[]> {
  const added = new Map<string, LineRange[]>();
  let ranges: LineRange[] | undefined;
  // Hunk bodies are skipped by count, so an added line whose text starts with
  // `++ b/` or `@@` is never mistaken for a header.
  let oldLeft = 0;
  let newLeft = 0;

  for (const line of diff.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      if (line.startsWith('-')) {
        oldLeft--;
      } else if (line.startsWith('+')) {
        newLeft--;
      }
      continue;
    }

    if (line.startsWith('+++ ')) {
      // Deleted files diff against /dev/null and leave nothing to judge.
      ranges = line.startsWith('+++ b/') ? [] : undefined;
      if (ranges) {
        added.set(line.slice('+++ b/'.length), ranges);
      }
      continue;
    }

    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
      newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
      const start = Number(hunk[2]);
      if (newLeft > 0) {
        ranges?.push({start, end: start + newLeft - 1});
      }
    }
  }

  return new Map([...added].filter(([, fileRanges]) => fileRanges.length > 0));
}

/**
 * Non-cone sparse-checkout patterns that leave only the conventions and the
 * patched files on disk, so every convention's prefilter and globs see the
 * patch instead of the whole codebase.
 *
 * Lint-path conventions are dropped: their `detect_command` needs the full
 * tree and installed dependencies, and the repo's own lint already blocks what
 * they would catch.
 */
export function sparsePatterns(files: string[], lintConventionFiles: string[]): string[] {
  const escape = (path: string) => path.replace(/[\\*?[]/g, '\\$&');
  return [
    `/${CONFIG_DIR}/`,
    ...lintConventionFiles.map(file => `!/${CONVENTIONS_DIR}/${escape(file)}`),
    ...files.map(file => `/${escape(file)}`),
  ];
}

/**
 * Lines in a finding's span that its snippet quotes verbatim. Snippets are
 * often abbreviated (`{ ... }`), and lines with no word characters (`}`,
 * `/**`) recur everywhere, so neither can say where the violation is.
 */
export function quotedLines(finding: Finding, fileContent: string): number[] {
  const quoted = new Set(
    finding.snippet
      .split('\n')
      .map(line => line.trim())
      .filter(line => /\w/.test(line))
  );
  const lines = fileContent.split('\n');
  const result: number[] = [];
  for (
    let line = finding.line_start;
    line <= Math.min(finding.line_end, lines.length);
    line++
  ) {
    if (quoted.has(lines[line - 1]!.trim())) {
      result.push(line);
    }
  }
  return result;
}

/**
 * The scanner judges each file whole, so it also reports violations the base
 * branch already had; those are the fixes loop's job. A violation is new when
 * the patch adds a line its snippet quotes. Overlapping the span is not
 * enough: editing one line inside an existing class component must not
 * re-report the class.
 */
export function introducedFindings(
  findings: Finding[],
  added: Map<string, LineRange[]>,
  readFile: (path: string) => string
): Finding[] {
  return findings.filter(finding => {
    const ranges = added.get(finding.file);
    return (
      ranges !== undefined &&
      quotedLines(finding, readFile(finding.file)).some(line =>
        ranges.some(range => range.start <= line && line <= range.end)
      )
    );
  });
}

function lintConventionFiles(): string[] {
  return readdirSync(CONVENTIONS_DIR).filter(
    file =>
      /\.ya?ml$/.test(file) &&
      /^detect_command:/m.test(readFileSync(join(CONVENTIONS_DIR, file), 'utf8'))
  );
}

function formatFinding(finding: Finding): string {
  return [
    `${finding.file}:${finding.line_start}-${finding.line_end} ${finding.pattern_name} (${finding.severity}, ${finding.confidence} confidence)`,
    `  ${finding.explanation}`,
  ].join('\n');
}

function writeStepSummary(findings: Finding[]) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }
  const escape = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
  const rows = findings.map(
    finding =>
      `| \`${finding.file}:${finding.line_start}\` | ${finding.pattern_name} | ${finding.severity} | ${finding.confidence} | ${escape(finding.explanation)} |`
  );
  appendFileSync(
    summaryPath,
    [
      `### ${findings.length} convention violation(s) in this patch`,
      '',
      '| Location | Convention | Severity | Confidence | Explanation |',
      '|---|---|---|---|---|',
      ...rows,
      '',
    ].join('\n')
  );
}

function main() {
  // The merge commit's first parent is the base branch tip, so this is the
  // patch exactly as it would land.
  const diff = execFileSync(
    'git',
    [
      'diff',
      '-U0',
      '--find-renames',
      '--no-color',
      '--no-ext-diff',
      // parseAddedLines reads paths from `+++ b/`, which diff.noprefix and
      // diff.mnemonicPrefix would change.
      '--src-prefix=a/',
      '--dst-prefix=b/',
      'HEAD^1',
      'HEAD',
    ],
    {encoding: 'utf8', maxBuffer: 512 * 1024 * 1024}
  );
  const added = parseAddedLines(diff);
  if (added.size === 0) {
    console.log('The patch adds no lines; nothing to judge.');
    return;
  }

  execFileSync('git', ['sparse-checkout', 'set', '--no-cone', '--stdin'], {
    input: sparsePatterns([...added.keys()], lintConventionFiles()).join('\n'),
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  const scan = spawnSync('pnpm', ['dlx', '@sentry/refactor-tasks', 'scan'], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (scan.status !== 0) {
    throw new Error(`refactor-tasks scan exited with ${scan.status ?? scan.signal}`);
  }

  const findings = introducedFindings(JSON.parse(scan.stdout) as Finding[], added, path =>
    readFileSync(path, 'utf8')
  );
  if (findings.length === 0) {
    console.log('No convention violations on lines added by this patch.');
    return;
  }

  console.log(
    `\n${findings.length} convention violation(s) on lines added by this patch:\n`
  );
  console.log(findings.map(formatFinding).join('\n\n'));
  writeStepSummary(findings);
  process.exitCode = 1;
}

if (import.meta.main) {
  main();
}
