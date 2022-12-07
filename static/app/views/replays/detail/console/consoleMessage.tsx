import {ComponentProps, useCallback} from 'react';
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
  style: any;
}
function ConsoleMessage({
  breadcrumb,
  isActive = false,
  isOcurring = false,
  hasOccurred,
  isLast,
  isCurrent,
  startTimestampMs = 0,
  style,
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

  // const timeHandlers = {
  //   isActive,
  //   isCurrent,
  //   isOcurring,
  //   hasOccurred,
  // };

  return (
    <ConsoleMessageItem
      style={style}
      isActive={isActive}
      isCurrent={isCurrent}
      isLast={isLast}
      level={breadcrumb.level}
      hasOccurred={hasOccurred}
      isOcurring={isOcurring}
      onMouseOver={handleOnMouseOver}
      onMouseOut={handleOnMouseOut}
    >
      <IconWrapper hasOccurred={hasOccurred}>
        <Icon>{ICONS[breadcrumb.level]}</Icon>
      </IconWrapper>
      <Message aria-current={isCurrent}>
        <ErrorBoundary mini>
          <MessageFormatter breadcrumb={breadcrumb} />
        </ErrorBoundary>
        <ViewIssueLink breadcrumb={breadcrumb} />
      </Message>
      <ConsoleTimestamp>
        <Tooltip title={<DateTime date={breadcrumb.timestamp} seconds />}>
          <ConsoleTimestampButton onClick={handleOnClick}>
            {showPlayerTime(breadcrumb.timestamp || '', startTimestampMs)}
          </ConsoleTimestampButton>
        </Tooltip>
      </ConsoleTimestamp>
    </ConsoleMessageItem>
  );
}

const ConsoleMessageItem = styled('div')<{
  isActive: boolean;
  isCurrent: boolean;
  isLast: boolean;
  level: string;
  hasOccurred?: boolean;
  isOcurring?: boolean;
}>`
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;

  display: grid;
  grid-template-columns: max-content 1fr max-content;

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

const ConsoleTimestamp = styled('div')`
  padding: ${space(0.25)} ${space(1)};
`;

const ConsoleTimestampButton = styled('button')`
  background: none;
  border: none;
`;

const IconWrapper = styled('div')<{hasOccurred?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  z-index: 2;
`;

const Icon = styled('div')<{isOcurring?: boolean}>`
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

const Message = styled('div')`
  padding: ${space(0.25)} 0;
  white-space: pre-wrap;
  word-break: break-word;
  display: flex;
  justify-content: space-between;
`;

export default ConsoleMessage;
