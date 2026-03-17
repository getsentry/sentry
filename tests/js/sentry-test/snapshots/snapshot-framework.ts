import type {ReactElement} from 'react';

import {closeBrowser, takeSnapshot} from './snapshot';

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
    // currentTestName looks like "Button dark snapshot: default".
    // Everything before " snapshot: " is the describe ancestry → group.
    const describePrefix = currentTestName?.split(' snapshot: ')[0]?.trim() ?? null;
    const group = describePrefix ? describePrefix.replace(/\s+/g, '/') : null;
    const fileSlug = group
      ? `${group}/${name}`.replace(/\s+/g, '/').toLowerCase()
      : name.toLowerCase();

    await takeSnapshot({
      fileSlug,
      displayName: name,
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
