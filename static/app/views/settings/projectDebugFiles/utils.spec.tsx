import {DebugFileFixture} from 'sentry-fixture/debugFile';

import {getPrettyFileType} from './utils';

describe('getPrettyFileType', () => {
  it('labels WASM source maps', () => {
    const dsym = DebugFileFixture({
      symbolType: 'wasmsourcemap',
      cpuName: 'any',
      data: undefined,
    });
    expect(getPrettyFileType(dsym)).toBe('WebAssembly source map');
  });

  it('falls back to the raw symbol type for unknown types', () => {
    const dsym = DebugFileFixture({
      symbolType: 'somethingnew',
      cpuName: 'any',
      data: undefined,
    });
    expect(getPrettyFileType(dsym)).toBe('somethingnew');
  });
});
