import {trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import type {ExceptionValue, Frame} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

function getJavaScriptFrame(
  frame: Frame,
  includeLocation: boolean,
  includeJSContext: boolean
): string {
  let result = '';
  if (frame.function == null) {
    result += '    at ? (';
  } else {
    result += '    at ' + frame.function + ' (';
  }
  if (frame.filename != null) {
    result += frame.filename;
  } else if (frame.module != null) {
    result += frame.module;
  }
  if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += ':' + frame.lineNo;
  }
  if (frame.colNo != null && frame.colNo >= 0 && includeLocation) {
    result += ':' + frame.colNo;
  }
  result += ')';
  if (includeJSContext) {
    frame.context.forEach(item => {
      if (frame.lineNo === item[0]) {
        result += '\n    ' + item[1]?.trim();
      }
    });
  }

  return result;
}

function getRubyFrame(frame: Frame, includeLocation: boolean): string {
  let result = '    from ';
  if (frame.filename != null) {
    result += frame.filename;
  } else if (frame.module == null) {
    result += '?';
  } else {
    result += '(' + frame.module + ')';
  }
  if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += ':' + frame.lineNo;
  }
  if (frame.function != null) {
    result += ":in '" + frame.function + "'";
  }
  return result;
}

function getPHPFrame(
  frame: Frame,
  frameIdxFromEnd: number,
  includeLocation: boolean
): string {
  const funcName = frame.function === 'null' ? '{main}' : frame.function;
  let result = `#${frameIdxFromEnd} ${frame.filename || frame.module}`;
  if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += `(${frame.lineNo})`;
  }
  if (frame.function != null) {
    result += `: ${funcName}`;
  }
  return result;
}

function getPythonFrame(frame: Frame, includeLocation: boolean): string {
  let result = '';
  if (frame.filename != null) {
    result += '  File "' + frame.filename + '"';
  } else if (frame.module == null) {
    result += '  ?';
  } else {
    result += '  Module "' + frame.module + '"';
  }
  if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += ', line ' + frame.lineNo;
  }
  if (frame.function != null) {
    result += ', in ' + frame.function;
  }
  if (frame.context) {
    frame.context.forEach(item => {
      if (item[0] === frame.lineNo) {
        result += '\n    ' + item[1]?.trim();
      }
    });
  }
  return result;
}

export function getJavaFrame(frame: Frame, includeLocation: boolean): string {
  let result = '    at ';

  if (frame.module != null) {
    result += frame.module + '.';
  }
  if (frame.function != null) {
    result += frame.function;
  }
  if (frame.filename != null) {
    result += '(' + frame.filename;
    if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
      result += ':' + frame.lineNo;
    }
    result += ')';
  } else if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += '(:' + frame.lineNo + ')';
  }
  return result;
}

function getGoFrame(frame: Frame, includeLocation: boolean): string {
  let result = '';
  if (frame.function == null) {
    result += '?()';
  } else {
    result += frame.function + '()';
  }

  result += '\n    ';
  if (frame.filename != null) {
    result += frame.filename;
  } else if (frame.module == null) {
    result += '?';
  } else {
    result += frame.module;
  }
  if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += ':' + frame.lineNo;
  }

  return result;
}

function getCSharpFrame(frame: Frame, includeLocation: boolean): string {
  let result = '  at ';
  if (frame.module != null) {
    result += frame.module + '.';
  }
  if (frame.function == null) {
    result += '?()';
  } else {
    result += frame.function + '()';
  }

  if (frame.filename != null) {
    result += ' in ' + frame.filename;
  }
  if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += ':line ' + frame.lineNo;
  }

  return result;
}

function getElixirFrame(frame: Frame, includeLocation: boolean): string {
  let result = '    ';

  if (frame.filename == null) {
    result += '?';
  } else {
    result += frame.filename;
  }
  if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += ':' + frame.lineNo + ': ';
  }

  if (frame.module != null) {
    result += frame.module + '.';
  }
  if (frame.function == null) {
    result += '?';
  } else {
    result += frame.function;
  }

  return result;
}

function getDartFrame(
  frame: Frame,
  frameIdxFromEnd: number,
  includeLocation: boolean
): string {
  let result = `#${frameIdxFromEnd}`;

  if (frame.function === '<asynchronous suspension>') {
    return `${result}      ${frame.function}`;
  }

  if (frame.function != null) {
    result += '      ' + frame.function;
  }
  if (frame.absPath != null) {
    result += ' (';

    result += frame.absPath;
    if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
      result += ':' + frame.lineNo;
    }
    if (frame.colNo != null && frame.colNo >= 0 && includeLocation) {
      result += ':' + frame.colNo;
    }

    result += ')';
  }

  return result;
}

function ljust(str: string, len: number) {
  return str + Array.from({length: Math.max(0, len - str.length) + 1}).join(' ');
}

function getNativeFrame(frame: Frame, includeLocation: boolean): string {
  let result = '  ';
  if (frame.package != null) {
    result += ljust(trimPackage(frame.package), 20);
  }
  if (frame.instructionAddr != null) {
    result += ljust(frame.instructionAddr, 12);
  }
  result += ' ' + (frame.function || frame.symbolAddr);
  if (frame.filename != null) {
    result += ' (' + frame.filename;
    if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
      result += ':' + frame.lineNo;
    }
    result += ')';
  }
  return result;
}

function getDefaultFrame(frame: Frame, includeLocation: boolean): string {
  let result = '';
  if (frame.filename != null) {
    result += '  File "' + frame.filename + '"';
  } else if (frame.module == null) {
    result += '  ?';
  } else {
    result += '  Module "' + frame.module + '"';
  }
  if (frame.lineNo != null && frame.lineNo >= 0 && includeLocation) {
    result += ', line ' + frame.lineNo;
  }
  if (frame.colNo != null && frame.colNo >= 0 && includeLocation) {
    result += ', col ' + frame.colNo;
  }
  if (frame.function != null) {
    result += ', in ' + frame.function;
  }
  return result;
}

function getExceptionSummary(
  exception: ExceptionValue,
  platform: string | undefined,
  isMinified?: boolean
): string {
  const exceptionValue = isMinified
    ? exception.rawValue || exception.value
    : exception.value;
  const exceptionType = isMinified ? exception.rawType || exception.type : exception.type;
  const exceptionModule = isMinified
    ? exception.rawModule || exception.module
    : exception.module;
  switch (platform) {
    case 'java': {
      let result = `${exceptionType}: ${exceptionValue}`;
      if (exceptionModule) {
        result = `${exceptionModule}.${result}`;
      }
      return result;
    }
    default:
      return `${exceptionType}: ${exceptionValue}`;
  }
}

function getFrame(
  frame: Frame,
  frameIdxFromEnd: number,
  platform: string | undefined,
  includeLocation: boolean,
  includeJSContext: boolean
): string {
  if (frame.platform) {
    platform = frame.platform;
  }
  switch (platform) {
    case 'javascript':
      return getJavaScriptFrame(frame, includeLocation, includeJSContext);
    case 'node':
      return getJavaScriptFrame(frame, includeLocation, includeJSContext);
    case 'ruby':
      return getRubyFrame(frame, includeLocation);
    case 'php':
      return getPHPFrame(frame, frameIdxFromEnd, includeLocation);
    case 'python':
      return getPythonFrame(frame, includeLocation);
    case 'java':
      return getJavaFrame(frame, includeLocation);
    case 'go':
      return getGoFrame(frame, includeLocation);
    case 'csharp':
      return getCSharpFrame(frame, includeLocation);
    case 'elixir':
      return getElixirFrame(frame, includeLocation);
    case 'dart':
      return getDartFrame(frame, frameIdxFromEnd, includeLocation);
    case 'objc':
    // fallthrough
    case 'cocoa':
    // fallthrough
    case 'native':
      return getNativeFrame(frame, includeLocation);
    default:
      return getDefaultFrame(frame, includeLocation);
  }
}

type DisplayRawContentArgs = {
  /** The parsed stack trace data. */
  data: StacktraceType | null;
  /** The platform of this stack trace. */
  platform: string | undefined;
  /** The exception captured by this stack trace. */
  exception?: ExceptionValue;
  /** Whether the similarity embeddings feature is enabled. */
  hasSimilarityEmbeddingsFeature?: boolean;
  /** Whether to include source code context in stack trace frames for JavaScript. */
  includeJSContext?: boolean;
  /** Whether to include location (e.g. line number, column number) in stack trace frames. */
  includeLocation?: boolean;
  /** Whether the stack trace is minified. */
  isMinified?: boolean;
  /** Whether to display the frames from newest to oldest. */
  newestFirst?: boolean;
  // If true, the generated stack trace will be in the default format for the platform.
  // If false, the stack trace will be structured according to newestFirst.
  rawTrace?: boolean;
};

/**
 * For the given stack trace, generates an array of platform-specific raw content (strings)
 * representing the frames, with configurable display options.
 *
 * @returns Array of formatted strings representing the stack trace, one per frame.
 */
export function displayRawContent({
  data,
  platform,
  exception,
  hasSimilarityEmbeddingsFeature = false,
  includeLocation = true,
  rawTrace = true,
  isMinified = false,
  newestFirst = true,
  includeJSContext = false,
}: DisplayRawContentArgs) {
  const rawFrames = data?.frames || [];

  const hasInAppFrames = rawFrames.some(frame => frame.inApp);
  const shouldFilterOutSystemFrames = hasSimilarityEmbeddingsFeature && hasInAppFrames;

  const framesToUse = shouldFilterOutSystemFrames
    ? rawFrames.filter(frame => frame.inApp)
    : rawFrames;

  const frames = framesToUse.map((frame, frameIdx) =>
    getFrame(
      frame,
      framesToUse.length - frameIdx - 1,
      platform,
      includeLocation,
      includeJSContext
    )
  );

  if (exception) {
    frames.push(getExceptionSummary(exception, platform, isMinified));
  }

  // For the raw stacktrace view on the issue details page, ignore newestFirst and order frames based on default platform behavior
  if (rawTrace) {
    newestFirst = platform !== 'python';
  }

  if (newestFirst) {
    frames.reverse();
  }

  if (platform === 'python') {
    // In raw Python stacktraces, newestFirst is always false. For diff view, it's based on user preference.
    const mostRecentCallLocation = newestFirst ? 'first' : 'last';
    frames.unshift(`Traceback (most recent call ${mostRecentCallLocation}):`);
  } else if (!newestFirst) {
    frames.unshift('Stack trace (most recent call last):');
  }

  return frames.join('\n');
}
