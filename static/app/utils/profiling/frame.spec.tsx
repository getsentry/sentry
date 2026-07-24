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
          file: 'bar.js',
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

  describe('java frames', () => {
    it('qualifies name with module', () => {
      expect(
        new Frame(
          {
            key: 0,
            name: 'call',
            module: 'rx.internal.util.ScalarSynchronousObservable$ScalarAsyncOnSubscribe',
            platform: 'java',
          },
          'mobile'
        ).name
      ).toBe('rx.internal.util.ScalarSynchronousObservable$ScalarAsyncOnSubscribe.call');
    });

    it('shows only module for constructors', () => {
      expect(
        new Frame(
          {
            key: 0,
            name: '<init>',
            module: 'com.example.Foo',
            platform: 'java',
          },
          'mobile'
        ).name
      ).toBe('com.example.Foo');
    });

    it('keeps bare name when module is missing', () => {
      expect(
        new Frame({key: 0, name: 'art_jni_trampoline', platform: 'java'}, 'mobile').name
      ).toBe('art_jni_trampoline');
    });

    it('does not qualify non-java frames', () => {
      expect(
        new Frame(
          {key: 0, name: 'memcpy', module: 'libc.so', platform: 'native'},
          'mobile'
        ).name
      ).toBe('memcpy');
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
