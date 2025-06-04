import {Frame} from 'sentry/utils/profiling/frame';

describe('Frame', () => {
  describe.each([['javascript'], ['node']])(
    'renames unknown frame to <anonymous> for platform %s',
    platform => {
      it('sets anonymouse name if frame has no name', () => {
        expect(new Frame({key: 0, name: '', line: 0, column: 0}, platform).name).toBe(
          '<anonymous>'
        );
      });

      it('appends [native code] to name if frame belongs to native code', () => {
        expect(
          new Frame(
            {key: 0, name: 'foo', line: undefined, column: undefined},
            platform
          ).name.endsWith('[native code]')
        ).toBe(true);
      });
    }
  );
  it('marks frame as extension', () => {
    for (const prefix of ['@moz-extension://', 'chrome-extension://']) {
      expect(
        new Frame(
          {
            key: 0,
            name: 'foo',
            line: undefined,
            column: undefined,
            file: `${prefix}foo/bar.js`,
          },
          'javascript'
        ).is_browser_extension
      ).toBe(true);
    }
    expect(
      new Frame(
        {
          key: 0,
          name: 'foo',
          line: undefined,
          column: undefined,
          file: `bar.js`,
        },
        'javascript'
      ).is_browser_extension
    ).toBe(false);
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
      ).toBeUndefined();
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

  it('formats getSourceLocation', () => {
    const frame = new Frame(
      {
        key: 0,
        name: 'testFunction',
        file: 'test.js',
        line: 10,
        column: 5,
      },
      'javascript'
    );
    expect(frame.getSourceLocation()).toBe('test.js:10:5');
  });

  it('formats getSourceLocation when file is unknown', () => {
    const frame = new Frame(
      {
        key: 0,
        name: 'testFunction',
        file: undefined,
        line: undefined,
        column: undefined,
      },
      'javascript'
    );
    expect(frame.getSourceLocation()).toBe('<unknown>:<unknown line>:<unknown column>');
  });
});
