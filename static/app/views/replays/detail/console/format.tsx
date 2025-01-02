// This is based on https://github.com/browserify/node-util/blob/master/util.js
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
import {Fragment} from 'react';
import styled from '@emotion/styled';

import StructuredEventData from 'sentry/components/structuredEventData';
import type {OnExpandCallback} from 'sentry/views/replays/detail/useVirtualizedInspector';

const formatRegExp = /%[csdj%]/g;
interface FormatProps {
  args: any[];
  onExpand: OnExpandCallback;
  expandPaths?: string[];
}

/**
 * Based on node's `util.format()`, returns a formatted "string" using the
 * first argument as a printf-like format string which can contain zero or more
 * format specifiers. Uses `<StructuredEventData>` to print objects.
 *
 * %c is ignored for now
 */
export default function Format({onExpand, expandPaths, args}: FormatProps) {
  const onToggleExpand = (expandedPaths, path) => {
    onExpand(path, Object.fromEntries(expandedPaths.map(item => [item, true])));
  };
  const f = args[0];

  if (typeof f !== 'string') {
    const objects: any[] = [];
    for (let i = 0; i < args.length; i++) {
      objects.push(
        <Wrapper key={i}>
          <StructuredEventData
            key={i}
            data={args[i]}
            initialExpandedPaths={expandPaths ?? []}
            onToggleExpand={onToggleExpand}
          />
        </Wrapper>
      );
    }
    return <Fragment>{objects}</Fragment>;
  }

  let i = 1;
  let styling: string | undefined;
  const len = args.length;
  const pieces: any[] = [];

  const str = String(f).replace(formatRegExp, function (x) {
    if (x === '%%') {
      return '%';
    }
    if (i >= len) {
      return x;
    }
    switch (x) {
      case '%c':
        styling = args[i++];
        return '';
      case '%s':
        const val = args[i++];
        try {
          return String(val);
        } catch {
          return 'toString' in val ? val.toString : JSON.stringify(val);
        }
      case '%d':
        return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });

  if (styling && typeof styling === 'string') {
    const tempEl = document.createElement('div');
    tempEl.setAttribute('style', styling);

    // Only allow certain CSS attributes, be careful of css properties that
    // accept `url()`
    //
    // See the section above https://developer.mozilla.org/en-US/docs/Web/API/console#using_groups_in_the_console
    // for the properties that Firefox supports.
    const styleObj = Object.fromEntries(
      [
        ['background-color', 'backgroundColor'],
        ['border-radius', 'borderRadius'],
        ['color', 'color'],
        ['font-size', 'fontSize'],
        ['font-style', 'fontStyle'],
        ['font-weight', 'fontWeight'],
        ['margin', 'margin'],
        ['padding', 'padding'],
        ['text-transform', 'textTransform'],
        ['writing-mode', 'writingMode'],
      ]
        .map(([attr, reactAttr]) => [reactAttr, tempEl.style.getPropertyValue(attr!)])
        .filter(([, val]) => !!val)
    );

    styleObj.display = 'inline-block';

    pieces.push(
      <span key={`%c-${i - 1}`} style={styleObj}>
        {str}
      </span>
    );
  } else {
    pieces.push(str);
  }

  for (let x = args[i]; i < len; x = args[++i]) {
    if (x === null || typeof x !== 'object') {
      pieces.push(' ' + x);
    } else {
      pieces.push(' ');
      pieces.push(
        <Wrapper key={i}>
          <StructuredEventData
            key={i}
            data={x}
            initialExpandedPaths={expandPaths ?? []}
            onToggleExpand={onToggleExpand}
          />
        </Wrapper>
      );
    }
  }

  return <Fragment>{pieces}</Fragment>;
}

const Wrapper = styled('div')`
  pre {
    margin: 0;
    background: none;
    font-size: inherit;
  }
`;
