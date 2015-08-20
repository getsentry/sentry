import React from "react";
import PropTypes from "../../proptypes";
import {defined, trim} from "../../utils";

function getException(exception, platform) {
  switch (platform) {
    case "php":
      return getPHPException(exception);
    case "java":
    case "javascript":
    case "python":
    case "ruby":
    /* falls through */
    default:
      return getDefaultException(exception);
  }
}

export function getPHPException(exception) {
  var result = exception.type + ': '  + exception.value;
  if (exception.module) {
    result += ' in ' + exception.module;
  }
  result += '\nStack trace:';
  return result;
}

export function getDefaultException(exception) {
  return exception.type + ': ' + exception.value;
}

function getFrame(frame, platform, index) {
  switch (platform) {
    case "javascript":
      return getJavaScriptFrame(frame);
    case "ruby":
      return getRubyFrame(frame);
    case "java":
      return getJavaFrame(frame);
    case "php":
      return getPHPFrame(frame, index);
    case "python": // default
    /* falls through */
    default:
      return getPythonFrame(frame);
  }
}

function getJavaScriptFrame(frame) {
  var result = '';
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
  var result = '  from ';
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
  var result = '';
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
  var result = '    at';
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

export function getPHPFrame(frame, index) {
  // NOTE: doesn't include vars
  var result = '#' + index + ' ';
  if (defined(frame.filename)) {
    result += frame.filename;
    if (defined(frame.lineNo)) {
      result += '(' + frame.lineNo;
      if (defined(frame.colNo)) {
        result += ':' + frame.colNo;
      }
      result += ')';
    }
    result += ': ';
  }
  if (defined(frame.module)) {
    result += frame.module + '->';
  }
  if (defined(frame.function)) {
    result += frame.function + '()';
  }
  return result;
}

export default function render (data, platform, exception) {
  var firstFrameOmitted, lastFrameOmitted;
  var children = [];

  if (exception) {
    children.push(getException(exception, platform));
  }

  if (data.framesOmitted) {
    firstFrameOmitted = data.framesOmitted[0];
    lastFrameOmitted = data.framesOmitted[1];
  } else {
    firstFrameOmitted = null;
    lastFrameOmitted = null;
  }

  data.frames.forEach((frame, frameIdx) => {
    children.push(getFrame(frame, platform, frameIdx));
    if (frameIdx === firstFrameOmitted) {
      children.push((
        '.. frames ' + firstFrameOmitted + ' until ' + lastFrameOmitted + ' were omitted and not available ..'
      ));
    }

  });

  return children.join('\n');
}
