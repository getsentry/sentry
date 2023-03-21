import {Fragment} from 'react';
import {chromeLight, ObjectInspector} from 'react-inspector';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {objectIsEmpty} from 'sentry/utils';

interface Props {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
  onDimensionChange?: () => void;
}

const formatRegExp = /%[sdj%]/g;
function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
function isNull(arg) {
  return arg === null;
}
const format = function (onDimensionChange, ...args) {
  const INSPECTOR_THEME = {
    ...chromeLight,
    BASE_BACKGROUND_COLOR: 'none',
    OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 1,
  };

  const f = args[0];
  if (typeof f !== 'string') {
    const objects: any[] = [];
    for (let i = 0; i < arguments.length; i++) {
      objects.push(
        <ObjectInspector
          key={i}
          data={arguments[i]}
          // @ts-expect-error
          theme={INSPECTOR_THEME}
          onExpand={onDimensionChange}
        />
      );
    }
    return <Fragment>{objects}</Fragment>;
  }

  let i = 1;
  const len = args.length;
  const pieces: any[] = [];

  // @ts-expect-error
  const str = String(f).replace(formatRegExp, function (x) {
    if (x === '%%') {
      return '%';
    }
    if (i >= len) {
      return x;
    }
    switch (x) {
      case '%s':
        return String(args[i++]);
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
  pieces.push(str);
  for (let x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      pieces.push(' ' + x);
    } else {
      pieces.push(' ');
      pieces.push(
        <ObjectInspector
          data={x}
          // @ts-expect-error
          theme={INSPECTOR_THEME}
          onExpand={onDimensionChange}
        />
      );
    }
  }
  return <Fragment>{pieces}</Fragment>;
};

/**
 * Attempt to emulate the browser console as much as possible
 */
function MessageFormatter({breadcrumb, onDimensionChange}: Props) {
  let logMessage: any = '';

  if (!breadcrumb.data?.arguments) {
    // There is a possibility that we don't have arguments as we could be receiving an exception type breadcrumb.
    // In these cases we just need the message prop.

    // There are cases in which our prop message is an array, we want to force it to become a string
    logMessage = breadcrumb.message?.toString() || '';
    return <AnnotatedText meta={getMeta(breadcrumb, 'message')} value={logMessage} />;
  }

  // There is a special case where `console.error()` is called with an Error object.
  // The SDK uses the Error's `message` property as the breadcrumb message, but we lose the Error type,
  // resulting in an empty object in the breadcrumb arguments. In this case, we
  // only want to use `breadcrumb.message`.
  if (
    breadcrumb.message &&
    breadcrumb.data?.arguments.length === 1 &&
    isObject(breadcrumb.data.arguments[0]) &&
    objectIsEmpty(breadcrumb.data.arguments[0])
  ) {
    logMessage = breadcrumb.message;
  } else {
    logMessage = format(onDimensionChange, ...breadcrumb.data.arguments);
  }

  return logMessage;
}

export default MessageFormatter;
