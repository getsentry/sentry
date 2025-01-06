import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';
import {FrameFixture} from 'sentry-fixture/frame';

import displayRawContent, {
  getJavaFrame,
  getJavaPreamble,
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
          })
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
          })
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
          })
        )
      ).toBe(
        '    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java)'
      );
    });
  });

  describe('getJavaPreamble()', () => {
    it('takes a type and value', () => {
      expect(
        getJavaPreamble(
          ExceptionValueFixture({
            type: 'Baz',
            value: 'message',
            module: undefined,
          })
        )
      ).toBe('Baz: message');
    });

    it('takes a module name', () => {
      expect(
        getJavaPreamble(
          ExceptionValueFixture({
            module: 'foo.bar',
            type: 'Baz',
            value: 'message',
          })
        )
      ).toBe('foo.bar.Baz: message');
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
          filename: 'application',
          platform: undefined,
        }),
        FrameFixture({
          function: 'doThing',
          module: 'example.application',
          lineNo: 2,
          filename: 'application',
          platform: undefined,
        }),
      ],
    };

    it('renders java example', () => {
      expect(displayRawContent(data, 'java', exception)).toBe(
        `example.application.Error: an error occurred
    at example.application.doThing(application:2)
    at example.application.main(application:1)`
      );
    });

    it('renders python example', () => {
      expect(displayRawContent(data, 'python', exception)).toBe(
        `Error: an error occurred
  File "application", line 1, in main
  File "application", line 2, in doThing`
      );
    });

    it('renders dart example', () => {
      const dartData: StacktraceType = {
        hasSystemFrames: false,
        framesOmitted: null,
        registers: {},
        frames: [
          FrameFixture({
            function: 'doThing',
            package: 'flutter',
            lineNo: 300,
            colNo: 2,
            filename: 'ink_well.dart',
            absPath: 'package:flutter/src/material/ink_well.dart',
            platform: undefined,
          }),
          FrameFixture({
            function: '<asynchronous suspension>',
            package: '<asynchronous suspension>',
            platform: undefined,
          }),
          FrameFixture({
            function: 'main',
            package: 'sentry_flutter',
            lineNo: 778,
            colNo: 5,
            filename: 'main.dart',
            absPath: 'package:sentry_flutter/main.dart',
            platform: undefined,
          }),
        ],
      };
      expect(displayRawContent(dartData, 'dart', exception)).toBe(
        `Error: an error occurred
  #0      main (package:sentry_flutter/main.dart:778:5)
  #1      <asynchronous suspension>
  #2      doThing (package:flutter/src/material/ink_well.dart:300:2)`
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
        expect(displayRawContent(stacktrace, 'python', exception)).toBe(
          `Error: an error occurred
  File "application", line 1, in main
  File "application", line 2, in doThing`
        );
      }
    );

    it.each([true, false])(
      'renders system frames when no in-app frames exist, regardless of similarity feature',
      similarityFeatureEnabled => {
        expect(
          displayRawContent(
            onlySystemFrames,
            'python',
            exception,
            similarityFeatureEnabled
          )
        ).toBe(
          `Error: an error occurred
  File "application", line 1, in main
  File "application", line 2, in doThing`
        );
      }
    );

    it('renders only in-app frames when they exist and hasSimilarityEmbeddingsFeature is on', () => {
      expect(displayRawContent(mixedFrames, 'python', exception, true)).toBe(
        `Error: an error occurred
  File "application", line 1, in main`
      );
    });
  });
});
