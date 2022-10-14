import {trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import {ExceptionValue, Frame} from 'sentry/types';
import {StacktraceType} from 'sentry/types/stacktrace';
import {defined, trim} from 'sentry/utils';

function getJavaScriptFrame(frame: Frame): string {
  let result = '';
  if (defined(frame.function)) {
    result += '  at ' + frame.function + '(';
  } else {
    result += '  at ? (';
  }
  if (defined(frame.filename)) {
    result += frame.filename;
  } else if (defined(frame.module)) {
    result += frame.module;
  }
  if (defined(frame.lineNo) && frame.lineNo >= 0) {
    result += ':' + frame.lineNo;
  }
  if (defined(frame.colNo) && frame.colNo >= 0) {
    result += ':' + frame.colNo;
  }
  result += ')';
  return result;
}

function getRubyFrame(frame: Frame): string {
  let result = '  from ';
  if (defined(frame.filename)) {
    result += frame.filename;
  } else if (defined(frame.module)) {
    result += '(' + frame.module + ')';
  } else {
    result += '?';
  }
  if (defined(frame.lineNo) && frame.lineNo >= 0) {
    result += ':' + frame.lineNo;
  }
  if (defined(frame.colNo) && frame.colNo >= 0) {
    result += ':' + frame.colNo;
  }
  if (defined(frame.function)) {
    result += ':in `' + frame.function + "'";
  }
  return result;
}

export function getPHPFrame(frame: Frame, idx: number): string {
  const funcName = frame.function === 'null' ? '{main}' : frame.function;
  return `#${idx} ${frame.filename || frame.module}(${frame.lineNo}): ${funcName}`;
}

export function getPythonFrame(frame: Frame): string {
  let result = '';
  if (defined(frame.filename)) {
    result += '  File "' + frame.filename + '"';
  } else if (defined(frame.module)) {
    result += '  Module "' + frame.module + '"';
  } else {
    result += '  ?';
  }
  if (defined(frame.lineNo) && frame.lineNo >= 0) {
    result += ', line ' + frame.lineNo;
  }
  if (defined(frame.colNo) && frame.colNo >= 0) {
    result += ', col ' + frame.colNo;
  }
  if (defined(frame.function)) {
    result += ', in ' + frame.function;
  }
  if (defined(frame.context)) {
    frame.context.forEach(item => {
      if (item[0] === frame.lineNo) {
        result += '\n    ' + trim(item[1]);
      }
    });
  }
  return result;
}

export function getJavaFrame(frame: Frame): string {
  let result = '    at';
  if (defined(frame.module)) {
    result += ' ' + frame.module + '.';
  }
  if (defined(frame.function)) {
    result += frame.function;
  }
  if (defined(frame.filename)) {
    result += '(' + frame.filename;
    if (defined(frame.lineNo) && frame.lineNo >= 0) {
      result += ':' + frame.lineNo;
    }
    result += ')';
  }
  return result;
}

function ljust(str: string, len: number) {
  return str + Array(Math.max(0, len - str.length) + 1).join(' ');
}

export function getNativeFrame(frame: Frame): string {
  let result = '  ';
  if (defined(frame.package)) {
    result += ljust(trimPackage(frame.package), 20);
  }
  if (defined(frame.instructionAddr)) {
    result += ljust(frame.instructionAddr, 12);
  }
  result += ' ' + (frame.function || frame.symbolAddr);
  if (defined(frame.filename)) {
    result += ' (' + frame.filename;
    if (defined(frame.lineNo) && frame.lineNo >= 0) {
      result += ':' + frame.lineNo;
    }
    result += ')';
  }
  return result;
}

export function getJavaPreamble(exception: ExceptionValue): string {
  let result = `${exception.type}: ${exception.value}`;
  if (exception.module) {
    result = `${exception.module}.${result}`;
  }
  return result;
}

function getPreamble(exception: ExceptionValue, platform: string | undefined): string {
  switch (platform) {
    case 'java':
      return getJavaPreamble(exception);
    default:
      return exception.type + ': ' + exception.value;
  }
}

function getFrame(frame: Frame, frameIdx: number, platform: string | undefined): string {
  if (frame.platform) {
    platform = frame.platform;
  }
  switch (platform) {
    case 'javascript':
      return getJavaScriptFrame(frame);
    case 'ruby':
      return getRubyFrame(frame);
    case 'php':
      return getPHPFrame(frame, frameIdx);
    case 'python':
      return getPythonFrame(frame);
    case 'java':
      return getJavaFrame(frame);
    case 'objc':
    // fallthrough
    case 'cocoa':
    // fallthrough
    case 'native':
      return getNativeFrame(frame);
    default:
      return getPythonFrame(frame);
  }
}

export default function displayRawContent(
  data: StacktraceType,
  platform?: string,
  exception?: ExceptionValue
) {
  const frames: string[] = [];

  (data?.frames ?? []).forEach((frame, frameIdx) => {
    frames.push(getFrame(frame, frameIdx, platform));
  });

  if (platform !== 'python') {
    frames.reverse();
  }

  if (exception) {
    frames.unshift(getPreamble(exception, platform));
  }

  return frames.join('\n');
}
