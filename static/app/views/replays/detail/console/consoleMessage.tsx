import {ComponentProps, Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs, showPlayerTime} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {IconClose, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import MessageFormatter from 'sentry/views/replays/detail/console/messageFormatter';
import ViewIssueLink from 'sentry/views/replays/detail/console/viewIssueLink';

const ICONS = {
  error: <IconClose isCircled size="xs" />,
  warning: <IconWarning size="xs" />,
};

interface Props extends ComponentProps<typeof MessageFormatter> {
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
}: Props) {
  const {setCurrentTime, setCurrentHoverTime} = useReplayContext();

  const diff = relativeTimeInMs(breadcrumb.timestamp || '', startTimestampMs);
  const handleOnClick = useCallback(() => setCurrentTime(diff), [setCurrentTime, diff]);
  const handleOnMouseOver = useCallback(
    () => setCurrentHoverTime(diff),
    [setCurrentHoverTime, diff]
  );
  const handleOnMouseOut = useCallback(
    () => setCurrentHoverTime(undefined),
    [setCurrentHoverTime]
  );

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
        <ViewIssueLink breadcrumb={breadcrumb} />
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
  display: flex;
  justify-content: space-between;
`;

export default ConsoleMessage;
