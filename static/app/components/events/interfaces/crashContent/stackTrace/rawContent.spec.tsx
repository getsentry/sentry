import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';
import {FrameFixture} from 'sentry-fixture/frame';

import displayRawContent, {
  getJavaFrame,
} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import type {StacktraceType} from 'sentry/types/stacktrace';

describe('RawStacktraceContent', () => {
  describe('getJavaFrame()', () => {
    it('should render java frames', () => {
      expect(
        getJavaFrame(
          FrameFixture({
            module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
            function: 'run',
            filename: 'QueuedThreadPool.java',
            lineNo: 582,
          }),
          true
        )
      ).toBe(
        '    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java:582)'
      );

      // without line number
      expect(
        getJavaFrame(
          FrameFixture({
            module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
            function: 'run',
            filename: 'QueuedThreadPool.java',
          }),
          true
        )
      ).toBe(
        '    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java)'
      );

      // without line number and filename
      expect(
        getJavaFrame(
          FrameFixture({
            module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
            function: 'run',
            filename: 'QueuedThreadPool.java',
          }),
          true
        )
      ).toBe(
        '    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java)'
      );
    });
  });

  describe('getExceptionSummary()', () => {
    it('renders non-minified exception for java platform', () => {
      const exception = ExceptionValueFixture({
        module: 'com.example.app',
        type: 'CustomException',
        value: 'Original error message',
      });

      expect(
        displayRawContent({
          data: {
            hasSystemFrames: false,
            framesOmitted: null,
            registers: {},
            frames: [],
          },
          platform: 'java',
          exception,
          isMinified: false,
        })
      ).toBe('com.example.app.CustomException: Original error message');
    });

    it('renders minified exception using raw values for java platform', () => {
      const exception = ExceptionValueFixture({
        module: 'com.example.app',
        type: 'CustomException',
        value: 'Original error message',
        rawModule: 'c.d.e',
        rawType: 'a',
        rawValue: 'Obfuscated error',
      });

      expect(
        displayRawContent({
          data: {
            hasSystemFrames: false,
            framesOmitted: null,
            registers: {},
            frames: [],
          },
          platform: 'java',
          exception,
          isMinified: true,
        })
      ).toBe('c.d.e.a: Obfuscated error');
    });

    it('falls back to deobfuscated values when raw values are missing', () => {
      const exception = ExceptionValueFixture({
        module: 'com.example.app',
        type: 'CustomException',
        value: 'Original error message',
      });

      expect(
        displayRawContent({
          data: {
            hasSystemFrames: false,
            framesOmitted: null,
            registers: {},
            frames: [],
          },
          platform: 'java',
          exception,
          isMinified: true,
        })
      ).toBe('com.example.app.CustomException: Original error message');
    });

    it('renders minified exception for non-java platforms', () => {
      const exception = ExceptionValueFixture({
        type: 'CustomError',
        value: 'Original error message',
        rawType: 'Error',
        rawValue: 'Obfuscated error',
      });

      expect(
        displayRawContent({
          data: {
            hasSystemFrames: false,
            framesOmitted: null,
            registers: {},
            frames: [],
          },
          platform: 'javascript',
          exception,
          isMinified: true,
        })
      ).toBe('Error: Obfuscated error');
    });

    it('handles exception without module for java platform', () => {
      const exception = ExceptionValueFixture({
        type: 'IllegalStateException',
        value: 'Oops!',
        module: undefined,
      });

      expect(
        displayRawContent({
          data: {
            hasSystemFrames: false,
            framesOmitted: null,
            registers: {},
            frames: [],
          },
          platform: 'java',
          exception,
          isMinified: false,
        })
      ).toBe('IllegalStateException: Oops!');
    });
  });

  describe('render()', () => {
    const exception = ExceptionValueFixture({
      module: 'example.application',
      type: 'Error',
      value: 'an error occurred',
    });

    const data: StacktraceType = {
      hasSystemFrames: false,
      framesOmitted: null,
      registers: {},
      frames: [
        FrameFixture({
          function: 'main',
          module: 'example.application',
          lineNo: 1,
          colNo: 14,
          filename: 'src/application.code',
          platform: undefined,
        }),
        FrameFixture({
          function: 'doThing1',
          module: null,
          lineNo: 5,
          colNo: 9,
          filename: 'src/application.code',
          platform: undefined,
        }),
        FrameFixture({
          function: null,
          module: 'example.application',
          lineNo: 1,
          colNo: 6,
          filename: 'src/application.code',
          platform: undefined,
        }),
        FrameFixture({
          function: 'doThing3',
          module: 'example.application',
          lineNo: 12,
          colNo: 24,
          filename: null,
          platform: undefined,
        }),
      ],
    };

    it('renders javascript example', () => {
      expect(displayRawContent({data, platform: 'javascript', exception})).toBe(
        `Error: an error occurred
    at doThing3 (example.application:12:24)
    at ? (src/application.code:1:6)
    at doThing1 (src/application.code:5:9)
    at main (src/application.code:1:14)`
      );
    });

    it('renders javascript example - rawTrace, newestFirst', () => {
      expect(
        displayRawContent({
          data,
          platform: 'javascript',
          exception,
          rawTrace: true,
          newestFirst: true,
        })
      ).toBe(
        `Error: an error occurred
    at doThing3 (example.application:12:24)
    at ? (src/application.code:1:6)
    at doThing1 (src/application.code:5:9)
    at main (src/application.code:1:14)`
      );
    });

    it('renders javascript example - !rawTrace, newestFirst', () => {
      expect(
        displayRawContent({
          data,
          platform: 'javascript',
          exception,
          rawTrace: false,
          newestFirst: true,
        })
      ).toBe(
        `Error: an error occurred
    at doThing3 (example.application:12:24)
    at ? (src/application.code:1:6)
    at doThing1 (src/application.code:5:9)
    at main (src/application.code:1:14)`
      );
    });

    it('renders javascript example - rawTrace, !newestFirst', () => {
      expect(
        displayRawContent({
          data,
          platform: 'javascript',
          exception,
          rawTrace: true,
          newestFirst: false,
        })
      ).toBe(
        `Error: an error occurred
    at doThing3 (example.application:12:24)
    at ? (src/application.code:1:6)
    at doThing1 (src/application.code:5:9)
    at main (src/application.code:1:14)`
      );
    });

    it('renders javascript example - !rawTrace, !newestFirst', () => {
      expect(
        displayRawContent({
          data,
          platform: 'javascript',
          exception,
          rawTrace: false,
          newestFirst: false,
        })
      ).toBe(
        `Stack trace (most recent call last):
    at main (src/application.code:1:14)
    at doThing1 (src/application.code:5:9)
    at ? (src/application.code:1:6)
    at doThing3 (example.application:12:24)
Error: an error occurred`
      );
    });

    it('renders node example', () => {
      expect(displayRawContent({data, platform: 'node', exception})).toBe(
        `Error: an error occurred
    at doThing3 (example.application:12:24)
    at ? (src/application.code:1:6)
    at doThing1 (src/application.code:5:9)
    at main (src/application.code:1:14)`
      );
    });

    it('renders ruby example', () => {
      expect(displayRawContent({data, platform: 'ruby', exception})).toBe(
        `Error: an error occurred
    from (example.application):12:in 'doThing3'
    from src/application.code:1
    from src/application.code:5:in 'doThing1'
    from src/application.code:1:in 'main'`
      );
    });

    it('renders php example', () => {
      expect(displayRawContent({data, platform: 'php', exception})).toBe(
        `Error: an error occurred
#0 example.application(12): doThing3
#1 src/application.code(1)
#2 src/application.code(5): doThing1
#3 src/application.code(1): main`
      );
    });

    it('renders python example', () => {
      expect(displayRawContent({data, platform: 'python', exception})).toBe(
        `Traceback (most recent call last):
  File "src/application.code", line 1, in main
  File "src/application.code", line 5, in doThing1
  File "src/application.code", line 1
  Module "example.application", line 12, in doThing3
Error: an error occurred`
      );
    });

    it('renders python example - rawTrace, newestFirst', () => {
      expect(
        displayRawContent({
          data,
          platform: 'python',
          exception,
          rawTrace: true,
          newestFirst: true,
        })
      ).toBe(
        `Traceback (most recent call last):
  File "src/application.code", line 1, in main
  File "src/application.code", line 5, in doThing1
  File "src/application.code", line 1
  Module "example.application", line 12, in doThing3
Error: an error occurred`
      );
    });

    it('renders python example - !rawTrace, newestFirst', () => {
      expect(
        displayRawContent({
          data,
          platform: 'python',
          exception,
          rawTrace: false,
          newestFirst: true,
        })
      ).toBe(
        `Traceback (most recent call first):
Error: an error occurred
  Module "example.application", line 12, in doThing3
  File "src/application.code", line 1
  File "src/application.code", line 5, in doThing1
  File "src/application.code", line 1, in main`
      );
    });

    it('renders python example - rawTrace, !newestFirst', () => {
      expect(
        displayRawContent({
          data,
          platform: 'python',
          exception,
          rawTrace: true,
          newestFirst: false,
        })
      ).toBe(
        `Traceback (most recent call last):
  File "src/application.code", line 1, in main
  File "src/application.code", line 5, in doThing1
  File "src/application.code", line 1
  Module "example.application", line 12, in doThing3
Error: an error occurred`
      );
    });

    it('renders python example - !rawTrace, !newestFirst', () => {
      expect(
        displayRawContent({
          data,
          platform: 'python',
          exception,
          rawTrace: false,
          newestFirst: false,
        })
      ).toBe(
        `Traceback (most recent call last):
  File "src/application.code", line 1, in main
  File "src/application.code", line 5, in doThing1
  File "src/application.code", line 1
  Module "example.application", line 12, in doThing3
Error: an error occurred`
      );
    });

    it('renders java example', () => {
      expect(displayRawContent({data, platform: 'java', exception})).toBe(
        `example.application.Error: an error occurred
    at example.application.doThing3(:12)
    at example.application.(src/application.code:1)
    at doThing1(src/application.code:5)
    at example.application.main(src/application.code:1)`
      );
    });

    it('renders go example', () => {
      expect(displayRawContent({data, platform: 'go', exception})).toBe(
        `Error: an error occurred
doThing3()
    example.application:12
?()
    src/application.code:1
doThing1()
    src/application.code:5
main()
    src/application.code:1`
      );
    });

    it('renders csharp example', () => {
      expect(displayRawContent({data, platform: 'csharp', exception})).toBe(
        `Error: an error occurred
  at example.application.doThing3():line 12
  at example.application.?() in src/application.code:line 1
  at doThing1() in src/application.code:line 5
  at example.application.main() in src/application.code:line 1`
      );
    });

    it('renders elixir example', () => {
      expect(displayRawContent({data, platform: 'elixir', exception})).toBe(
        `Error: an error occurred
    ?:12: example.application.doThing3
    src/application.code:1: example.application.?
    src/application.code:5: doThing1
    src/application.code:1: example.application.main`
      );
    });

    it('renders dart example', () => {
      const dartData: StacktraceType = {
        hasSystemFrames: false,
        framesOmitted: null,
        registers: {},
        frames: [
          FrameFixture({
            function: 'main',
            package: 'sentry_flutter',
            lineNo: 778,
            colNo: 5,
            filename: 'main.dart',
            absPath: 'package:sentry_flutter/main.dart',
            platform: undefined,
          }),
          FrameFixture({
            function: '<asynchronous suspension>',
            package: '<asynchronous suspension>',
            platform: undefined,
          }),
          FrameFixture({
            function: 'doThing',
            package: 'flutter',
            lineNo: 300,
            colNo: 2,
            filename: 'ink_well.dart',
            absPath: 'package:flutter/src/material/ink_well.dart',
            platform: undefined,
          }),
        ],
      };
      expect(displayRawContent({data: dartData, platform: 'dart', exception})).toBe(
        `Error: an error occurred
#0      doThing (package:flutter/src/material/ink_well.dart:300:2)
#1      <asynchronous suspension>
#2      main (package:sentry_flutter/main.dart:778:5)`
      );
    });

    const inAppFrame = (fnName: string, line: number) =>
      FrameFixture({
        function: fnName,
        module: 'example.application',
        lineNo: line,
        filename: 'application',
        platform: undefined,
      });
    const systemFrame = (fnName: string, line: number) =>
      FrameFixture({
        function: fnName,
        module: 'example.application',
        lineNo: line,
        filename: 'application',
        platform: undefined,
        inApp: false,
      });

    const onlyInAppFrames: StacktraceType = {
      hasSystemFrames: false,
      framesOmitted: null,
      registers: {},
      frames: [inAppFrame('main', 1), inAppFrame('doThing', 2)],
    };

    const onlySystemFrames: StacktraceType = {
      hasSystemFrames: false,
      framesOmitted: null,
      registers: {},
      frames: [systemFrame('main', 1), systemFrame('doThing', 2)],
    };

    const mixedFrames: StacktraceType = {
      hasSystemFrames: false,
      framesOmitted: null,
      registers: {},
      frames: [inAppFrame('main', 1), systemFrame('doThing', 2)],
    };

    it.each([onlyInAppFrames, onlySystemFrames, mixedFrames])(
      'renders all frames when similarity flag is off, in-app or not',
      stacktrace => {
        expect(displayRawContent({data: stacktrace, platform: 'python', exception})).toBe(
          `Traceback (most recent call last):
  File "application", line 1, in main
  File "application", line 2, in doThing
Error: an error occurred`
        );
      }
    );

    it.each([true, false])(
      'renders system frames when no in-app frames exist, regardless of similarity feature',
      similarityFeatureEnabled => {
        expect(
          displayRawContent({
            data: onlySystemFrames,
            platform: 'python',
            exception,
            hasSimilarityEmbeddingsFeature: similarityFeatureEnabled,
          })
        ).toBe(
          `Traceback (most recent call last):
  File "application", line 1, in main
  File "application", line 2, in doThing
Error: an error occurred`
        );
      }
    );

    it('renders only in-app frames when they exist and hasSimilarityEmbeddingsFeature is on', () => {
      expect(
        displayRawContent({
          data: mixedFrames,
          platform: 'python',
          exception,
          hasSimilarityEmbeddingsFeature: true,
        })
      ).toBe(
        `Traceback (most recent call last):
  File "application", line 1, in main
Error: an error occurred`
      );
    });
  });
});
