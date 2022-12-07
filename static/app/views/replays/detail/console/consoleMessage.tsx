import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {IconFire, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import MessageFormatter from 'sentry/views/replays/detail/console/messageFormatter';
import ViewIssueLink from 'sentry/views/replays/detail/console/viewIssueLink';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

const ICONS = {
  error: <IconFire size="xs" />,
  warning: <IconWarning size="xs" />,
};

interface Props extends ComponentProps<typeof MessageFormatter> {
  isCurrent: boolean;
  isHovered: boolean;
  onClickTimestamp: any;
  onMouseEnter: any;
  onMouseLeave: any;
  startTimestampMs: number;
  style: any;
}
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
    <ConsoleMessageItem
      isCurrent={isCurrent}
      isHovered={isHovered}
      level={breadcrumb.level}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <Icon>{ICONS[breadcrumb.level]}</Icon>
      <Message>
        <ErrorBoundary mini>
          <MessageFormatter breadcrumb={breadcrumb} />
        </ErrorBoundary>
        <IssueLinkWrapper>
          <ViewIssueLink breadcrumb={breadcrumb} />
        </IssueLinkWrapper>
      </Message>
      <TimestampButton
        onClick={onClickTimestamp}
        startTimestampMs={startTimestampMs}
        timestampMs={breadcrumb.timestamp || ''}
      />
    </ConsoleMessageItem>
  );
}

const IssueLinkWrapper = styled('div')``;

const ConsoleMessageItem = styled('div')<{
  isCurrent: boolean;
  isHovered: boolean;
  level: string;
}>`
  padding-block: ${space(0.25)};

  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(0.75)};
  padding: ${space(0.5)} ${space(1)};

  background-color: ${p =>
    ['warning', 'error'].includes(p.level)
      ? p.theme.alert[p.level].backgroundLight
      : 'inherit'};

  color: ${p =>
    ['warning', 'error'].includes(p.level)
      ? p.theme.alert[p.level].iconColor
      : 'inherit'};

  border-bottom: ${p => {
    if (p.isCurrent) {
      return `1px solid ${p.theme.purple300}`;
    }
    if (p.isHovered) {
      return `1px solid ${p.theme.purple200}`;
    }
    return `1px solid ${p.theme.innerBorder}`;
  }};

  & ${IssueLinkWrapper} {
    visibility: hidden;
  }

  &:hover ${IssueLinkWrapper} {
    visibility: visible;
  }
`;

const Icon = styled('div')``;

const Message = styled('div')`
  display: flex;
  justify-content: space-between;

  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: pre-wrap;
  word-break: break-word;
`;

export default ConsoleMessage;
