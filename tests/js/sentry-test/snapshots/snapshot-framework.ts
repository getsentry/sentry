import type {ReactElement} from 'react';

import {takeSnapshot, type SnapshotOptions} from './snapshot';

function snapshotTest(
  name: string,
  renderFn: () => ReactElement,
  options: SnapshotOptions = {}
): void {
  test(`snapshot: ${name}`, async () => {
    const testFilePath = expect.getState().testPath;
    if (!testFilePath) {
      throw new Error('Could not determine test file path');
    }
    await takeSnapshot(name, renderFn, options, testFilePath);
  });
}

test.snapshot = snapshotTest;

declare global {
  namespace jest {
    interface It {
      snapshot: typeof snapshotTest;
    }
  }
}
