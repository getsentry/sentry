import {CSSProperties, forwardRef, useMemo} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import Avatar from 'sentry/components/avatar';
import Link from 'sentry/components/links/link';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import useSortErrors from 'sentry/views/replays/detail/errorList/useSortErrors';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

const EMPTY_CELL = '--';

type Props = {
  columnIndex: number;
  crumb: Crumb;
  currentHoverTime: number | undefined;
  currentTime: number;
  handleMouseEnter: (crumb: Crumb) => void;
  handleMouseLeave: (crumb: Crumb) => void;
  onClickTimestamp: (crumb: Crumb) => void;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortErrors>['sortConfig'];
  startTimestampMs: number;
  style: CSSProperties;
};

type CellProps = {
  hasOccurred: boolean | undefined;
  align?: 'flex-start' | 'flex-end';
  className?: string;
  gap?: Parameters<typeof space>[0];
  numeric?: boolean;
  onClick?: undefined | (() => void);
};

const ErrorTableCell = forwardRef<HTMLDivElement, Props>(
  (
    {
      columnIndex,
      currentHoverTime,
      currentTime,
      handleMouseEnter,
      handleMouseLeave,
      onClickTimestamp,
      sortConfig,
      crumb,
      startTimestampMs,
      style,
    }: Props,
    ref
  ) => {
    const organization = useOrganization();

    // @ts-expect-error
    const {eventId, groupId, groupShortId, project: projectSlug} = crumb.data;
    const title = crumb.message;
    const {projects} = useProjects();
    const project = useMemo(
      () => projects.find(p => p.slug === projectSlug),
      [projects, projectSlug]
    );

    const issueUrl =
      groupId && eventId
        ? {
            pathname: normalizeUrl(
              `/organizations/${organization.slug}/issues/${groupId}/events/${eventId}/`
            ),
            query: {
              referrer: 'replay-errors',
            },
          }
        : null;

    const crumbTime = useMemo(
      // @ts-expect-error
      () => relativeTimeInMs(new Date(crumb.timestamp).getTime(), startTimestampMs),
      [crumb.timestamp, startTimestampMs]
    );
    const hasOccurred = currentTime >= crumbTime;
    const isBeforeHover = currentHoverTime === undefined || currentHoverTime >= crumbTime;

    const isByTimestamp = sortConfig.by === 'timestamp';
    const isAsc = isByTimestamp ? sortConfig.asc : undefined;
    const columnProps = {
      className: classNames({
        beforeCurrentTime: isByTimestamp
          ? isAsc
            ? hasOccurred
            : !hasOccurred
          : undefined,
        afterCurrentTime: isByTimestamp
          ? isAsc
            ? !hasOccurred
            : hasOccurred
          : undefined,
        beforeHoverTime:
          isByTimestamp && currentHoverTime !== undefined
            ? isAsc
              ? isBeforeHover
              : !isBeforeHover
            : undefined,
        afterHoverTime:
          isByTimestamp && currentHoverTime !== undefined
            ? isAsc
              ? !isBeforeHover
              : isBeforeHover
            : undefined,
      }),
      hasOccurred: isByTimestamp ? hasOccurred : undefined,
      onMouseEnter: () => handleMouseEnter(crumb),
      onMouseLeave: () => handleMouseLeave(crumb),
      ref,
      style,
    } as CellProps;

    const renderFns = [
      () => (
        <Cell {...columnProps} numeric align="flex-start">
          <QuickContextHoverWrapper
            dataRow={{
              id: eventId,
              'project.name': projectSlug,
            }}
            contextType={ContextType.EVENT}
            organization={organization}
          >
            {issueUrl ? (
              <Link to={issueUrl}>
                <Text>{getShortEventId(eventId || '')}</Text>
              </Link>
            ) : (
              <Text>{getShortEventId(eventId || '')}</Text>
            )}
          </QuickContextHoverWrapper>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Tooltip isHoverable title={title}>
            <Text>{title ?? EMPTY_CELL}</Text>
          </Tooltip>
        </Cell>
      ),
      () => (
        <Cell {...columnProps} gap={0.5}>
          <AvatarWrapper>
            <Avatar project={project} size={16} />
          </AvatarWrapper>
          <QuickContextHoverWrapper
            dataRow={{
              'issue.id': groupId,
              issue: groupShortId,
            }}
            contextType={ContextType.ISSUE}
            organization={organization}
          >
            {issueUrl ? (
              <Link to={issueUrl}>{groupShortId}</Link>
            ) : (
              <span>{groupShortId}</span>
            )}
          </QuickContextHoverWrapper>
        </Cell>
      ),
      () => (
        <Cell {...columnProps} numeric>
          <StyledTimestampButton
            format="mm:ss.SSS"
            onClick={() => {
              onClickTimestamp(crumb);
            }}
            startTimestampMs={startTimestampMs}
            timestampMs={crumb.timestamp || ''}
          />
        </Cell>
      ),
    ];

    return renderFns[columnIndex]();
  }
);

const cellBackground = p => {
  if (p.hasOccurred === undefined && !p.isStatusError) {
    const color = p.isHovered ? p.theme.hover : 'inherit';
    return `background-color: ${color};`;
  }
  return `background-color: inherit;`;
};

const cellColor = p => {
  return `color: ${p.hasOccurred !== false ? 'inherit' : p.theme.gray300};`;
};

const Cell = styled('div')<CellProps>`
  display: flex;
  gap: ${p => space(p.gap ?? 0)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  cursor: ${p => (p.onClick ? 'pointer' : 'inherit')};

  ${cellBackground}
  ${cellColor}

  ${p =>
    p.numeric &&
    `
    font-variant-numeric: tabular-nums;
    justify-content: ${p.align ?? 'flex-end'};
  `};
`;

const Text = styled('div')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  padding: ${space(0.75)} ${space(1.5)};
`;

const AvatarWrapper = styled('div')`
  align-self: center;
`;

const StyledTimestampButton = styled(TimestampButton)`
  padding-inline: ${space(1.5)};
`;

export default ErrorTableCell;
