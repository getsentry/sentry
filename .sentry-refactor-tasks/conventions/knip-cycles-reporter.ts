import {resolve} from 'node:path';

import type {Issue, Reporter} from 'knip';

// Knip's `cycles` reporter is for people. Read the same structured issues to
// produce the per-file JSON required by refactor-tasks' detect_command instead.
export function cycleResults(
  cwd: string,
  cycles: Array<Pick<Issue, 'filePath' | 'symbols'>>
) {
  const files = new Map<string, Map<number, Set<string>>>();

  for (const issue of cycles) {
    const symbols = issue.symbols;
    const root = symbols?.[0];
    if (!symbols || !root) {
      throw new Error(`Knip cycle has no dependency path: ${issue.filePath}`);
    }

    // Knip may omit a location for an edge. Anchor those findings at line 1.
    const line = root.line ?? 1;
    const filePath = resolve(cwd, issue.filePath);
    const locations = files.get(filePath) ?? new Map<number, Set<string>>();
    const paths = locations.get(line) ?? new Set<string>();
    const path = symbols.map(symbol => `${symbol.symbol}:${symbol.line ?? 1}`);
    paths.add([...path, path[0]].join(' → '));
    locations.set(line, paths);
    files.set(filePath, locations);
  }

  // Sentry fingerprints findings by convention + file + line. Combine paths
  // at the same location so a grouped issue retains all of its cycles.
  return [...files.keys()].sort().map(filePath => ({
    filePath,
    messages: [...(files.get(filePath)?.entries() ?? [])]
      .sort(([a], [b]) => a - b)
      .map(([line, paths]) => ({
        ruleId: 'no-circular-dependencies',
        line,
        message: `Circular dependencies through this import (${paths.size}):\n\n${[
          ...paths,
        ]
          .sort()
          .map(path => `- ${path}`)
          .join('\n')}`,
      })),
  }));
}

const reporter: Reporter = ({cwd, issues}) => {
  const cycles = Object.values(issues.cycles).flatMap(Object.values);
  // Write only JSON, including [] for a completed scan with no cycles. Errors
  // must propagate to Knip and the scanner, never become an empty result.
  process.stdout.write(`${JSON.stringify(cycleResults(cwd, cycles))}\n`);
};

export default reporter;
