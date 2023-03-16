import {CSSProperties, useCallback} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {IconFire, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import MessageFormatter from 'sentry/views/replays/detail/console/messageFormatter';
import {breadcrumbHasIssue} from 'sentry/views/replays/detail/console/utils';
import ViewIssueLink from 'sentry/views/replays/detail/console/viewIssueLink';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type Props = {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
  breadcrumbs: Extract<Crumb, BreadcrumbTypeDefault>[];
  startTimestampMs: number;
  style: CSSProperties;
};

function ConsoleMessage({breadcrumb, breadcrumbs, startTimestampMs, style}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const onClickTimestamp = useCallback(
    () => handleClick(breadcrumb),
    [handleClick, breadcrumb]
  );
  const onMouseEnter = useCallback(
    () => handleMouseEnter(breadcrumb),
    [handleMouseEnter, breadcrumb]
  );
  const onMouseLeave = useCallback(
    () => handleMouseLeave(breadcrumb),
    [handleMouseLeave, breadcrumb]
  );

  const current = getPrevReplayEvent({
    items: breadcrumbs,
    targetTimestampMs: startTimestampMs + currentTime,
    allowEqual: true,
    allowExact: true,
  });

  const hovered = currentHoverTime
    ? getPrevReplayEvent({
        items: breadcrumbs,
        targetTimestampMs: startTimestampMs + currentHoverTime,
        allowEqual: true,
        allowExact: true,
      })
    : undefined;

  const hasOccurred =
    currentTime >= relativeTimeInMs(breadcrumb.timestamp || 0, startTimestampMs);
  const isCurrent = breadcrumb.id === current?.id;
  const isHovered = breadcrumb.id === hovered?.id;

  return (
    <ConsoleLog
      hasOccurred={hasOccurred}
      isCurrent={isCurrent}
      isHovered={isHovered}
      level={breadcrumb.level}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <Icon level={breadcrumb.level} />
      <Message>
        {breadcrumbHasIssue(breadcrumb) ? (
          <IssueLinkWrapper>
            <ViewIssueLink breadcrumb={breadcrumb} />
          </IssueLinkWrapper>
        ) : null}
        <ErrorBoundary mini>
          <MessageFormatter breadcrumb={breadcrumb} />
        </ErrorBoundary>
      </Message>
      <TimestampButton
        onClick={onClickTimestamp}
        startTimestampMs={startTimestampMs}
        timestampMs={breadcrumb.timestamp || ''}
      />
    </ConsoleLog>
  );
}

const IssueLinkWrapper = styled('div')`
  float: right;
`;

const ConsoleLog = styled('div')<{
  hasOccurred: boolean;
  isCurrent: boolean;
  isHovered: boolean;
  level: string;
}>`
  display: grid;
  grid-template-columns: 12px 1fr max-content;
  gap: ${space(0.75)};
  padding: ${space(0.5)} ${space(1)};

  background-color: ${p =>
    ['warning', 'error'].includes(p.level)
      ? p.theme.alert[p.level].backgroundLight
      : 'inherit'};

  border-bottom: 1px solid
    ${p =>
      p.isCurrent ? p.theme.purple300 : p.isHovered ? p.theme.purple200 : 'transparent'};

  color: ${p =>
    ['warning', 'error'].includes(p.level)
      ? p.theme.alert[p.level].iconColor
      : p.hasOccurred
      ? 'inherit'
      : p.theme.gray300};

  /*
  Show the timestamp button "Play" icon when we hover the row.
  This is a really generic selector that could find many things, but for now it
  only targets the one thing that we expect.
  */
  &:hover button > svg {
    visibility: visible;
  }
`;

const ICONS = {
  error: <IconFire size="xs" />,
  warning: <IconWarning size="xs" />,
};

function Icon({level}: {level: Extract<Crumb, BreadcrumbTypeDefault>['level']}) {
  return <span>{ICONS[level]}</span>;
}

const Message = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: pre-wrap;
  word-break: break-word;
`;

export default ConsoleMessage;
