import {ComponentProps, CSSProperties, forwardRef, useMemo} from 'react';
import {ClassNames} from '@emotion/react';
import classNames from 'classnames';

import Avatar from 'sentry/components/avatar';
import Link from 'sentry/components/links/link';
import {
  AvatarWrapper,
  ButtonWrapper,
  Cell,
  Text,
} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import {getShortEventId} from 'sentry/utils/events';
import type useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ErrorFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import useSortErrors from 'sentry/views/replays/detail/errorList/useSortErrors';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

const EMPTY_CELL = '--';

interface Props extends ReturnType<typeof useCrumbHandlers> {
  columnIndex: number;
  currentHoverTime: number | undefined;
  currentTime: number;
  frame: ErrorFrame;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortErrors>['sortConfig'];
  startTimestampMs: number;
  style: CSSProperties;
}

const ErrorTableCell = forwardRef<HTMLDivElement, Props>(
  (
    {
      columnIndex,
      currentHoverTime,
      currentTime,
      frame,
      onMouseEnter,
      onMouseLeave,
      onClickTimestamp,
      sortConfig,
      startTimestampMs,
      style,
    }: Props,
    ref
  ) => {
    const organization = useOrganization();

    const {eventId, groupId, groupShortId, projectSlug} = frame.data;
    const title = frame.message;
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

    const hasOccurred = currentTime >= frame.offsetMs;
    const isBeforeHover =
      currentHoverTime === undefined || currentHoverTime >= frame.offsetMs;

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
      onMouseEnter: () => onMouseEnter(frame),
      onMouseLeave: () => onMouseLeave(frame),
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
            {eventUrl ? (
              <Link to={eventUrl}>
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
              </Link>
            ) : (
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
            )}
          </Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Text>
            <AvatarWrapper>
              <Avatar project={project} size={16} />
            </AvatarWrapper>
            {eventUrl ? (
              <Link to={eventUrl}>
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
              </Link>
            ) : (
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
            )}
          </Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps} numeric>
          <ButtonWrapper>
            <TimestampButton
              format="mm:ss.SSS"
              onClick={event => {
                event.stopPropagation();
                onClickTimestamp(frame);
              }}
              startTimestampMs={startTimestampMs}
              timestampMs={frame.timestampMs}
            />
          </ButtonWrapper>
        </Cell>
      ),
    ];

    return renderFns[columnIndex]();
  }
);

export default ErrorTableCell;
