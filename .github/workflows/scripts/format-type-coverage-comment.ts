import {appendFileSync, readFileSync} from 'node:fs';

const COMMENT_MARKER = '<!-- TYPE_COVERAGE_DIFF -->';
const MAX_ITEMS_PER_CATEGORY = 15;
const MAX_BODY_LENGTH = 65_000;

type Summary = {
  coverage: number;
  filesScanned: number;
  total: number;
  typed: number;
};

type AnySymbol = {
  column: number;
  file: string;
  kind: string;
  line: number;
  name: string;
};

type Assertion = {
  code: string;
  column: number;
  file: string;
  kind: string;
  line: number;
  targetType?: string;
};

type Report = {
  changes: {
    anySymbols?: {added: AnySymbol[]; removed: AnySymbol[]};
    nonNullAssertions?: {added: Assertion[]; removed: Assertion[]};
    typeAssertions?: {added: Assertion[]; removed: Assertion[]};
  };
  summaryComparison: {
    current: Summary;
    diff: {coverage: number; filesScanned: number; total: number; typed: number};
    old: Summary;
  };
};

function deltaStr(value: number, unit = '', invert = false): string {
  if (Math.abs(value) < 0.005 && unit === '%') return `±0${unit}`;
  if (value === 0) return `±0${unit}`;
  const sign = value > 0 ? '+' : '';
  const emoji = invert ? (value > 0 ? '🔴' : '🟢') : value > 0 ? '🟢' : '🔴';
  return `${emoji} ${sign}${value}${unit}`;
}

function formatItemsTable<T extends {file: string; line: number}>(
  items: T[],
  kind: string,
  formatter: (item: T) => string
): string {
  if (items.length === 0) return '';

  const sorted = [...items].sort((a, b) =>
    a.file !== b.file ? a.file.localeCompare(b.file) : a.line - b.line
  );

  const truncated = sorted.length > MAX_ITEMS_PER_CATEGORY;
  const displayed = truncated ? sorted.slice(0, MAX_ITEMS_PER_CATEGORY) : sorted;

  let md = `\n**${kind}** (${items.length} new)\n\n`;
  md += '| File | Line | Detail |\n';
  md += '|------|------|--------|\n';

  for (const item of displayed) {
    md += `| \`${item.file}\` | ${item.line} | ${formatter(item)} |\n`;
  }

  if (truncated) {
    md += `\n_...and ${sorted.length - MAX_ITEMS_PER_CATEGORY} more_\n`;
  }

  return md;
}

function formatComment(
  reportPath: string,
  coverageOutcome: string,
  repo: string,
  runId: string
): string {
  if (coverageOutcome === 'failure') {
    return [
      COMMENT_MARKER,
      '## 📊 Type Coverage Diff',
      '',
      `> ⚠️ Type coverage analysis failed. This is informational only and does not block the PR.`,
      '',
      `_Check the [workflow logs](https://github.com/${repo}/actions/runs/${runId}) for details._`,
    ].join('\n');
  }

  let report: Report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    return '';
  }

  const {summaryComparison, changes} = report;
  const {old: oldSummary, current: currentSummary, diff} = summaryComparison;

  const newAny = changes.anySymbols?.added?.length ?? 0;
  const newNonNull = changes.nonNullAssertions?.added?.length ?? 0;
  const newTypeAssert = changes.typeAssertions?.added?.length ?? 0;
  const totalNew = newAny + newNonNull + newTypeAssert;

  if (totalNew === 0) {
    return [
      COMMENT_MARKER,
      '## 📊 Type Coverage Diff',
      '',
      `✅ No new type safety issues introduced. Coverage: **${currentSummary.coverage.toFixed(2)}%**`,
    ].join('\n');
  }

  const lines: string[] = [COMMENT_MARKER];
  lines.push('## 📊 Type Coverage Diff');
  lines.push('');

  const oldUntyped = oldSummary.total - oldSummary.typed;
  const currentUntyped = currentSummary.total - currentSummary.typed;
  const untypedDelta = currentUntyped - oldUntyped;

  lines.push('| Metric | Before | After | Delta |');
  lines.push('|--------|-------:|------:|-------|');
  lines.push(
    `| Coverage | ${oldSummary.coverage.toFixed(2)}% | ${currentSummary.coverage.toFixed(2)}% | ${deltaStr(parseFloat(diff.coverage.toFixed(2)), '%')} |`
  );
  lines.push(
    `| Typed | ${oldSummary.typed.toLocaleString()} | ${currentSummary.typed.toLocaleString()} | ${deltaStr(diff.typed)} |`
  );
  lines.push(
    `| Untyped | ${oldUntyped.toLocaleString()} | ${currentUntyped.toLocaleString()} | ${deltaStr(untypedDelta, '', true)} |`
  );
  lines.push('');

  if (totalNew > 0) {
    lines.push('<details>');
    lines.push(
      `<summary>🔍 ${totalNew} new type safety issue${totalNew === 1 ? '' : 's'} introduced</summary>`
    );
    lines.push('');

    if (newAny > 0) {
      lines.push(
        formatItemsTable(
          changes.anySymbols!.added,
          '`any`-typed symbols',
          (item: AnySymbol) => `\`${item.name}\` (${item.kind})`
        )
      );
    }

    if (newNonNull > 0) {
      lines.push(
        formatItemsTable(
          changes.nonNullAssertions!.added,
          'Non-null assertions (`!`)',
          (item: Assertion) => `\`${item.code}\``
        )
      );
    }

    if (newTypeAssert > 0) {
      lines.push(
        formatItemsTable(
          changes.typeAssertions!.added,
          'Type assertions (`as`)',
          (item: Assertion) => `\`as ${item.targetType}\` — \`${item.code}\``
        )
      );
    }

    lines.push('</details>');
    lines.push('');
  }

  lines.push('_This is informational only and does not block the PR._');

  let body = lines.join('\n');

  if (body.length > MAX_BODY_LENGTH) {
    const truncMsg =
      '\n\n_Comment truncated due to size limits._\n_This is informational only and does not block the PR._';
    body = body.substring(0, MAX_BODY_LENGTH - truncMsg.length) + truncMsg;
  }

  return body;
}

const reportPath = process.env.REPORT_PATH ?? '/tmp/type-coverage-report.json';
const coverageOutcome = process.env.COVERAGE_OUTCOME ?? 'success';
const repo = process.env.GITHUB_REPOSITORY ?? '';
const runId = process.env.GITHUB_RUN_ID ?? '';

const body = formatComment(reportPath, coverageOutcome, repo, runId);

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile && body) {
  const delimiter = `EOF_${Date.now()}`;
  appendFileSync(outputFile, `body<<${delimiter}\n${body}\n${delimiter}\n`);
} else if (body) {
  process.stdout.write(body);
}
