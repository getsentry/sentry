import {ComponentProps, CSSProperties, forwardRef, useMemo} from 'react';
import {ClassNames} from '@emotion/react';
import classNames from 'classnames';

import Avatar from 'sentry/components/avatar';
import Link from 'sentry/components/links/link';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {
  AvatarWrapper,
  Cell,
  StyledTimestampButton,
  Text,
} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import type {Crumb} from 'sentry/types/breadcrumbs';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import useSortErrors from 'sentry/views/replays/detail/errorList/useSortErrors';

const EMPTY_CELL = '--';

type Props = {
  columnIndex: number;
  crumb: Crumb;
  currentHoverTime: number | undefined;
  currentTime: number;
  onClickTimestamp: (crumb: Crumb) => void;
  onMouseEnter: (crumb: Crumb) => void;
  onMouseLeave: (crumb: Crumb) => void;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortErrors>['sortConfig'];
  startTimestampMs: number;
  style: CSSProperties;
};

const ErrorTableCell = forwardRef<HTMLDivElement, Props>(
  (
    {
      columnIndex,
      currentHoverTime,
      currentTime,
      onMouseEnter,
      onMouseLeave,
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

    const eventUrl =
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
      onMouseEnter: () => onMouseEnter(crumb),
      onMouseLeave: () => onMouseLeave(crumb),
      ref,
      style,
    } as ComponentProps<typeof Cell>;

    const renderFns = [
      () => (
        <Cell {...columnProps} numeric align="flex-start">
          {eventUrl ? (
            <Link to={eventUrl}>
              <Text>{getShortEventId(eventId || '')}</Text>
            </Link>
          ) : (
            <Text>{getShortEventId(eventId || '')}</Text>
          )}
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Text>
            <ClassNames>
              {({css}) => (
                <QuickContextHovercard
                  dataRow={{
                    id: eventId,
                    'project.name': projectSlug,
                  }}
                  contextType={ContextType.EVENT}
                  organization={organization}
                  containerClassName={css`
                    display: inline;
                  `}
                >
                  {title ?? EMPTY_CELL}
                </QuickContextHovercard>
              )}
            </ClassNames>
          </Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Text>
            <AvatarWrapper>
              <Avatar project={project} size={16} />
            </AvatarWrapper>
            <QuickContextHovercard
              dataRow={{
                'issue.id': groupId,
                issue: groupShortId,
              }}
              contextType={ContextType.ISSUE}
              organization={organization}
            >
              <span>{groupShortId}</span>
            </QuickContextHovercard>
          </Text>
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

export default ErrorTableCell;
