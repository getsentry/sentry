import type {ReactElement} from 'react';

import {closeBrowser, takeSnapshot} from './snapshot';

function snapshotTest(name: string, renderFn: () => ReactElement): void {
  test(`snapshot: ${name}`, async () => {
    const {testPath, currentTestName} = expect.getState();
    if (!testPath) {
      throw new Error('Could not determine test file path');
    }
    // Use the full test name (including describe ancestors) for unique filenames.
    // currentTestName looks like "Button theme-light snapshot: priority-default".
    // Strip the "snapshot: " marker to produce a clean filename.
    const snapshotName = currentTestName
      ? currentTestName.replace(/\s*snapshot: /, ' ').trim()
      : name;
    await takeSnapshot(snapshotName, renderFn, testPath);
  });
}

snapshotTest.each = function snapshotEach<T>(table: T[]) {
  return (name: string, renderFn: (value: T) => ReactElement) => {
    for (const value of table) {
      const testName = name.replace('%s', String(value));
      snapshotTest(testName, () => renderFn(value));
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
        ) => (name: string, renderFn: (value: T) => ReactElement) => void;
      };
    }
  }
}
