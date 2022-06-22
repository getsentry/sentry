import {Fragment} from 'react';
import styled from '@emotion/styled';
import {sprintf, vsprintf} from 'sprintf-js';

import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs, showPlayerTime} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {IconClose, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';

interface MessageFormatterProps {
  breadcrumb: BreadcrumbTypeDefault;
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

  // Browser's console formatter only works on the first arg
  const [message, ...args] = breadcrumb.data?.arguments;

  const isMessageString = typeof message === 'string';

  const placeholders = isMessageString
    ? sprintf.parse(message).filter(parsed => Array.isArray(parsed))
    : [];

  // We check if there are placeholders to print the message accordingly with their correct values
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

    // If there're no placeholders then we should make sure there are no objects that we want to print
    // as the message prop do not print this objects correctly we need to handle pretty printing them
  } else if (breadcrumb.message?.includes('[object Object]')) {
    const argValues = breadcrumb.data?.arguments.map(renderString);

    logMessage = argValues.join(' ').trim();
  }

  // TODO(replays): Add better support for AnnotatedText (e.g. we use message
  // args from breadcrumb.data.arguments and not breadcrumb.message directly)
  return (
    <AnnotatedText
      meta={getMeta(breadcrumb, 'message')}
      value={logMessage || breadcrumb.message}
    />
  );
}

interface ConsoleMessageProps extends MessageFormatterProps {
  isActive: boolean;
  isLast: boolean;
  startTimestamp: number;
}
function ConsoleMessage({
  breadcrumb,
  isActive = false,
  isLast,
  startTimestamp = 0,
}: ConsoleMessageProps) {
  const ICONS = {
    error: <IconClose isCircled size="xs" />,
    warning: <IconWarning size="xs" />,
  };

  const {setCurrentTime, setCurrentHoverTime} = useReplayContext();

  const diff = relativeTimeInMs(breadcrumb.timestamp || '', startTimestamp);
  const handleOnClick = () => setCurrentTime(diff);
  const handleOnMouseOver = () => setCurrentHoverTime(diff);
  const handleOnMouseOut = () => setCurrentHoverTime(undefined);

  return (
    <Fragment>
      <Icon isLast={isLast} level={breadcrumb.level} isActive={isActive}>
        {ICONS[breadcrumb.level]}
      </Icon>
      <Message isLast={isLast} level={breadcrumb.level}>
        <ErrorBoundary mini>
          <MessageFormatter breadcrumb={breadcrumb} />
        </ErrorBoundary>
      </Message>
      <ConsoleTimestamp isLast={isLast} level={breadcrumb.level}>
        <Tooltip title={<DateTime date={breadcrumb.timestamp} seconds />}>
          <div
            onClick={handleOnClick}
            onMouseOver={handleOnMouseOver}
            onMouseOut={handleOnMouseOut}
          >
            {showPlayerTime(breadcrumb.timestamp || '', startTimestamp)}
          </div>
        </Tooltip>
      </ConsoleTimestamp>
    </Fragment>
  );
}

const Common = styled('div')<{isLast: boolean; level: string}>`
  background-color: ${p =>
    ['warning', 'error'].includes(p.level)
      ? p.theme.alert[p.level].backgroundLight
      : 'inherit'};
  color: ${p =>
    ['warning', 'error'].includes(p.level)
      ? p.theme.alert[p.level].iconHoverColor
      : 'inherit'};
  ${p => (!p.isLast ? `border-bottom: 1px solid ${p.theme.innerBorder}` : '')};
`;

const ConsoleTimestamp = styled(Common)<{isLast: boolean; level: string}>`
  padding: ${space(0.25)} ${space(1)};
  cursor: pointer;
`;

const Icon = styled(Common)<{isActive: boolean}>`
  padding: ${space(0.5)} ${space(1)};
  border-left: 4px solid ${p => (p.isActive ? p.theme.focus : 'transparent')};
`;
const Message = styled(Common)`
  padding: ${space(0.25)} 0;
  white-space: pre-wrap;
  word-break: break-word;
`;

export default ConsoleMessage;
