import {Fragment} from 'react';
import styled from '@emotion/styled';
import isObject from 'lodash/isObject';
import {sprintf, vsprintf} from 'sprintf-js';

import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs, showPlayerTime} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {IconClose, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {objectIsEmpty} from 'sentry/utils';

interface MessageFormatterProps {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
}

/**
 * Attempt to stringify
 */
function renderString(arg: string | number | boolean | Object) {
  if (typeof arg !== 'object') {
    return arg;
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return arg.toString();
  }
}

/**
 * Attempt to emulate the browser console as much as possible
 */
export function MessageFormatter({breadcrumb}: MessageFormatterProps) {
  let logMessage = '';

  if (!breadcrumb.data?.arguments) {
    // There is a possibility that we don't have arguments as we could be receiving an exception type breadcrumb.
    // In these cases we just need the message prop.

    // There are cases in which our prop message is an array, we want to force it to become a string
    logMessage = breadcrumb.message?.toString() || '';
    return <AnnotatedText meta={getMeta(breadcrumb, 'message')} value={logMessage} />;
  }

  // Browser's console formatter only works on the first arg
  const [message, ...args] = breadcrumb.data?.arguments;

  const isMessageString = typeof message === 'string';

  const placeholders = isMessageString
    ? sprintf.parse(message).filter(parsed => Array.isArray(parsed))
    : [];

  // Placeholders can only occur in the first argument and only if it is a string.
  // We can skip the below code and avoid using `sprintf` if there are no placeholders.
  if (placeholders.length) {
    // TODO `%c` is console specific, it applies colors to messages
    // for now we are stripping it as this is potentially risky to implement due to xss
    const consoleColorPlaceholderIndexes = placeholders
      .filter(([placeholder]) => placeholder === '%c')
      .map((_, i) => i);

    // Retrieve message formatting args
    const messageArgs = args.slice(0, placeholders.length);

    // Filter out args that were for %c
    for (const colorIndex of consoleColorPlaceholderIndexes) {
      messageArgs.splice(colorIndex, 1);
    }

    // Attempt to stringify the rest of the args
    const restArgs = args.slice(placeholders.length).map(renderString);

    const formattedMessage = isMessageString
      ? vsprintf(message.replaceAll('%c', ''), messageArgs)
      : renderString(message);

    logMessage = [formattedMessage, ...restArgs].join(' ').trim();
  } else if (
    breadcrumb.data?.arguments.length === 1 &&
    isObject(message) &&
    objectIsEmpty(message)
  ) {
    // There is a special case where `console.error()` is called with an Error object.
    // The SDK uses the Error's `message` property as the breadcrumb message, but we lose the Error type,
    // resulting in an empty object in the breadcrumb arguments. In this case, we
    // only want to use `breadcrumb.message`.
    logMessage = breadcrumb.message || JSON.stringify(message);
  } else {
    // If the string `[object Object]` is found in message, it means the SDK attempted to stringify an object,
    // but the actual object should be captured in the arguments.
    //
    // Likewise if arrays are found e.g. [test,test] the SDK will serialize it to 'test, test'.
    //
    // In those cases, we'll want to use our pretty print in every argument that was passed to the logger instead of using
    // the SDK's serialization.
    const argValues = breadcrumb.data?.arguments.map(renderString);

    logMessage = argValues.join(' ').trim();
  }

  // TODO(replays): Add better support for AnnotatedText (e.g. we use message
  // args from breadcrumb.data.arguments and not breadcrumb.message directly)
  return <AnnotatedText meta={getMeta(breadcrumb, 'message')} value={logMessage} />;
}

interface ConsoleMessageProps extends MessageFormatterProps {
  hasOccurred: boolean;
  isActive: boolean;
  isCurrent: boolean;
  isLast: boolean;
  isOcurring: boolean;
  startTimestampMs: number;
}
function ConsoleMessage({
  breadcrumb,
  isActive = false,
  isOcurring = false,
  hasOccurred,
  isLast,
  isCurrent,
  startTimestampMs = 0,
}: ConsoleMessageProps) {
  const ICONS = {
    error: <IconClose isCircled size="xs" />,
    warning: <IconWarning size="xs" />,
  };

  const {setCurrentTime, setCurrentHoverTime} = useReplayContext();

  const diff = relativeTimeInMs(breadcrumb.timestamp || '', startTimestampMs);
  const handleOnClick = () => setCurrentTime(diff);
  const handleOnMouseOver = () => setCurrentHoverTime(diff);
  const handleOnMouseOut = () => setCurrentHoverTime(undefined);

  const timeHandlers = {
    isActive,
    isCurrent,
    isOcurring,
    hasOccurred,
  };

  return (
    <Fragment>
      <Icon
        isLast={isLast}
        level={breadcrumb.level}
        onMouseOver={handleOnMouseOver}
        onMouseOut={handleOnMouseOut}
        {...timeHandlers}
      >
        {ICONS[breadcrumb.level]}
      </Icon>
      <Message
        isLast={isLast}
        level={breadcrumb.level}
        onMouseOver={handleOnMouseOver}
        onMouseOut={handleOnMouseOut}
        aria-current={isCurrent}
        {...timeHandlers}
      >
        <ErrorBoundary mini>
          <MessageFormatter breadcrumb={breadcrumb} />
        </ErrorBoundary>
      </Message>
      <ConsoleTimestamp isLast={isLast} level={breadcrumb.level} {...timeHandlers}>
        <Tooltip title={<DateTime date={breadcrumb.timestamp} seconds />}>
          <ConsoleTimestampButton
            onClick={handleOnClick}
            onMouseOver={handleOnMouseOver}
            onMouseOut={handleOnMouseOut}
          >
            {showPlayerTime(breadcrumb.timestamp || '', startTimestampMs)}
          </ConsoleTimestampButton>
        </Tooltip>
      </ConsoleTimestamp>
    </Fragment>
  );
}

const Common = styled('div')<{
  isActive: boolean;
  isCurrent: boolean;
  isLast: boolean;
  level: string;
  hasOccurred?: boolean;
  isOcurring?: boolean;
}>`
  background-color: ${p =>
    ['warning', 'error'].includes(p.level)
      ? p.theme.alert[p.level].backgroundLight
      : 'inherit'};
  color: ${({hasOccurred = true, ...p}) => {
    if (!hasOccurred) {
      return p.theme.gray300;
    }

    if (['warning', 'error'].includes(p.level)) {
      return p.theme.alert[p.level].iconHoverColor;
    }

    return 'inherit';
  }};

  transition: color 0.5s ease;

  border-bottom: ${p => {
    if (p.isCurrent) {
      return `1px solid ${p.theme.purple300}`;
    }

    if (p.isActive && !p.isOcurring) {
      return `1px solid ${p.theme.purple200}`;
    }

    if (p.isLast) {
      return 'none';
    }

    return `1px solid ${p.theme.innerBorder}`;
  }};
`;

const ConsoleTimestamp = styled(Common)`
  padding: ${space(0.25)} ${space(1)};
`;

const ConsoleTimestampButton = styled('button')`
  background: none;
  border: none;
`;

const Icon = styled(Common)<{isOcurring?: boolean}>`
  padding: ${space(0.5)} ${space(1)};
  position: relative;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    height: 100%;
    width: ${space(0.5)};
    background-color: ${p => (p.isOcurring ? p.theme.focus : 'transparent')};
  }
`;
const Message = styled(Common)`
  padding: ${space(0.25)} 0;
  white-space: pre-wrap;
  word-break: break-word;
`;

export default ConsoleMessage;
