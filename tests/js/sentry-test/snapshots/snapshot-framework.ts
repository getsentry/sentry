import type {ReactElement} from 'react';

import {closeBrowser, takeSnapshot} from './snapshot';

interface SnapshotDetails {
  displayName: string;
  fileSlug: string;
  group: string | null;
}

/**
 * Parses Jest's `currentTestName` to extract snapshot details.
 *
 * Jest joins describe blocks and test name with spaces, e.g.:
 *   "Button dark snapshot: default"
 *
 * We split on the " snapshot: " marker (added by snapshotTest) to separate:
 *   - group: the describe ancestry ("Button dark" -> "Button/dark")
 *   - displayName: the test name passed to it.snapshot ("default")
 *   - fileSlug: a path-safe filename combining both ("button/dark/default")
 */
function parseSnapshotDetails(testName: string, fallbackName: string): SnapshotDetails {
  const parts = testName.split(' snapshot: ');
  if (parts.length < 2) {
    return {
      displayName: fallbackName,
      fileSlug: fallbackName.toLowerCase(),
      group: null,
    };
  }

  const group = parts[0]!.trim().replace(/\s+/g, '/');
  const displayName = parts[1]!.trim();
  const fileSlug = `${group}/${displayName}`.replace(/\s+/g, '').toLowerCase();

  return {displayName, fileSlug, group};
}

function snapshotTest(
  name: string,
  renderFn: () => ReactElement,
  metadata: Record<string, string> = {}
): void {
  test(`snapshot: ${name}`, async () => {
    const {testPath, currentTestName} = expect.getState();
    if (!testPath) {
      throw new Error('Could not determine test file path');
    }

    const {displayName, fileSlug, group} = parseSnapshotDetails(
      currentTestName ?? '',
      name
    );

    await takeSnapshot({
      fileSlug,
      displayName,
      renderFn,
      testFilePath: testPath,
      group,
      metadata,
    });
  });
}

snapshotTest.each = function snapshotEach<T>(table: T[]) {
  return (
    name: string,
    renderFn: (value: T) => ReactElement,
    metadataFn?: (value: T) => Record<string, string>
  ) => {
    for (const value of table) {
      const testName = name.replace('%s', String(value));
      snapshotTest(testName, () => renderFn(value), metadataFn?.(value));
    }
  };
};

afterAll(async () => {
  await closeBrowser();
});

test.snapshot = snapshotTest;

declare global {
  namespace jest {
    interface It {
      snapshot: typeof snapshotTest & {
        each: <T>(
          table: T[]
        ) => (
          name: string,
          renderFn: (value: T) => ReactElement,
          metadataFn?: (value: T) => Record<string, string>
        ) => void;
      };
    }
  }
}
