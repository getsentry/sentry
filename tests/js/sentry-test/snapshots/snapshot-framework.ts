import type {ReactElement} from 'react';

import {takeSnapshot, type SnapshotOptions} from './snapshot';

function snapshotTest(
  name: string,
  optionsOrRenderFn: SnapshotOptions | (() => ReactElement),
  maybeRenderFn?: () => ReactElement
): void {
  let options: SnapshotOptions = {};
  let renderFn: () => ReactElement;

  if (typeof optionsOrRenderFn === 'function') {
    renderFn = optionsOrRenderFn;
  } else {
    options = optionsOrRenderFn;
    if (!maybeRenderFn) {
      throw new Error('it.snapshot() requires a render function');
    }
    renderFn = maybeRenderFn;
  }

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
