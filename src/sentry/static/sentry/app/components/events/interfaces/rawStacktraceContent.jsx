import {defined, trim} from '../../../utils';

function getJavaScriptFrame(frame) {
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

function getRubyFrame(frame) {
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
    result += ':in `' + frame.function + '\'';
  }
  return result;
}

export function getPythonFrame(frame) {
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
    frame.context.forEach((item) => {
      if (item[0] === frame.lineNo) {
        result += '\n    ' + trim(item[1]);
      }
    });
  }
  return result;
}

export function getJavaFrame(frame) {
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

function ljust(str, len) {
  return str + Array(Math.max(0, len - str.length) + 1).join(' ');
}

export function getCocoaFrame(frame) {
  let result = '  ';
  if (defined(frame.package)) {
    result += ljust(frame.package, 20);
  }
  if (defined(frame.instructionAddr)) {
    result += ljust(frame.instructionAddr, 12);
  }
  result += ' ' + (frame.function || frame.symbolAddr);
  if (frame.instructionOffset) {
    result += ' + ' + frame.instructionOffset;
  }
  if (defined(frame.filename)) {
    result += ' (' + frame.filename;
    if (defined(frame.lineNo) && frame.lineNo >= 0) {
      result += ':' + frame.lineNo;
    }
    result += ')';
  }
  return result;
}

export function getJavaPreamble(exception) {
  let result = `${exception.type}: ${exception.value}`;
  if (exception.module) {
    result = `${exception.module}.${result}`;
  }
  return result;
}

function getPreamble(exception, platform) {
  switch (platform) {
    case 'java':
      return getJavaPreamble(exception);
    default:
      return exception.type + ': ' + exception.value;
  }
}

function getFrame(frame, platform) {
  switch (platform) {
    case 'javascript':
      return getJavaScriptFrame(frame);
    case 'ruby':
      return getRubyFrame(frame);
    case 'python':
      return getPythonFrame(frame);
    case 'java':
      return getJavaFrame(frame);
    case 'objc':
    case 'cocoa':
      return getCocoaFrame(frame);
    default:
      return getPythonFrame(frame);
  }
}

export default function render (data, platform, exception) {
  let firstFrameOmitted, lastFrameOmitted;
  let frames = [];

  if (data.framesOmitted) {
    firstFrameOmitted = data.framesOmitted[0];
    lastFrameOmitted = data.framesOmitted[1];
  } else {
    firstFrameOmitted = null;
    lastFrameOmitted = null;
  }

  data.frames.forEach((frame, frameIdx) => {
    frames.push(getFrame(frame, platform));
    if (frameIdx === firstFrameOmitted) {
      frames.push((
        '.. frames ' + firstFrameOmitted + ' until ' + lastFrameOmitted + ' were omitted and not available ..'
      ));
    }

  });

  if (platform !== 'python') {
    frames.reverse();
  }

  if (exception) {
    frames.unshift(getPreamble(exception, platform));
  }

  return frames.join('\n');
}
