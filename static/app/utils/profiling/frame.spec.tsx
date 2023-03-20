import {Frame} from 'sentry/utils/profiling/frame';

describe('Frame', () => {
  describe('web', () => {
    it('sets anonymouse name if frame has no name', () => {
      expect(new Frame({key: 0, name: '', line: 0, column: 0}, 'web').name).toBe(
        '<anonymous>'
      );
    });

    it('appends [native code] to name if frame belongs to native code', () => {
      expect(
        new Frame(
          {key: 0, name: 'foo', line: undefined, column: undefined},
          'web'
        ).name.endsWith('[native code]')
      ).toBe(true);
    });
  });
  describe('pulls package from path for web|node platforms', () => {
    it('file in node modules', () => {
      expect(
        new Frame(
          {
            key: 0,
            name: 'Foo',
            path: '/usr/code/node_modules/file.js',
            line: undefined,
            column: undefined,
          },
          'node'
        ).module
      ).toBe(undefined);
    });
    it.each([
      ['node:internal/crypto/hash', 'node:internal/crypto'],
      ['node:vm', 'node:vm'],
      ['/usr/code/node_modules/@sentry/profiling-node/file.js', '@sentry/profiling-node'],
      ['/usr/code/node_modules/sentry/profiling-node/file.js', 'sentry'],
      ['/usr/code/node_modules/sentry/file.js', 'sentry'],
      [
        'C:\\Program Files (x86)\\node_modules\\@sentry\\profiling-node\\file.js',
        '@sentry/profiling-node',
      ],
      [
        'C:\\Program Files (x86)\\node_modules\\sentry\\profiling-node\\file.js',
        'sentry',
      ],
      ['C:\\Program Files (x86)\\node_modules\\sentry\\file.js', 'sentry'],
    ])('%s -> %s', (path, expected) => {
      expect(
        new Frame(
          {
            key: 0,
            name: 'Foo',
            path,
            line: undefined,
            column: undefined,
          },
          'node'
        ).module
      ).toBe(expected);
    });
  });
});
