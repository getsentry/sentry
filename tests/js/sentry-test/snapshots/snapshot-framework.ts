import type {ReactElement} from 'react';

import {closeBrowser, takeSnapshot} from './snapshot';

function snapshotTest(name: string, renderFn: () => ReactElement): void {
  test(`snapshot: ${name}`, async () => {
    const testFilePath = expect.getState().testPath;
    if (!testFilePath) {
      throw new Error('Could not determine test file path');
    }
    await takeSnapshot(name, renderFn, testFilePath);
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
