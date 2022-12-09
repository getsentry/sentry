import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {IconFire, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import MessageFormatter from 'sentry/views/replays/detail/console/messageFormatter';
import {breadcrumbHasIssue} from 'sentry/views/replays/detail/console/utils';
import ViewIssueLink from 'sentry/views/replays/detail/console/viewIssueLink';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type Props = {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
  isCurrent: boolean;
  isHovered: boolean;
  onClickTimestamp: any;
  onMouseEnter: any;
  onMouseLeave: any;
  startTimestampMs: number;
  style: any;
};

function ConsoleMessage({
  breadcrumb,
  isCurrent,
  isHovered,
  onClickTimestamp,
  onMouseEnter,
  onMouseLeave,
  startTimestampMs = 0,
  style,
}: Props) {
  return (
    <ConsoleLog
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
        format="mm:ss"
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
      p.isCurrent
        ? p.theme.purple300
        : p.isHovered
        ? p.theme.purple200
        : p.theme.innerBorder};

  color: ${p =>
    ['warning', 'error'].includes(p.level)
      ? p.theme.alert[p.level].iconColor
      : 'inherit'};

  & ${IssueLinkWrapper} {
    visibility: hidden;
  }

  &:hover ${IssueLinkWrapper} {
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
