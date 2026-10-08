import type {ReactNode, Ref} from 'react';
import {useMemo} from 'react';
import {ClassNames} from '@emotion/react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {getShortEventId} from 'sentry/utils/events';
import type {useCrumbHandlers} from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ErrorFrame} from 'sentry/utils/replays/types';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import {TimelineRow} from 'sentry/views/explore/replays/detail/timelineRow';
import {TimestampButton} from 'sentry/views/explore/replays/detail/timestampButton';

const EMPTY_CELL = '--';

interface Props extends ReturnType<typeof useCrumbHandlers> {
  className: string;
  dataIndex: number;
  frame: ErrorFrame;
  startTimestampMs: number;
  ref?: Ref<HTMLTableRowElement>;
}

export function ErrorTableRow({
  className,
  dataIndex,
  frame,
  onMouseEnter,
  onMouseLeave,
  onClickTimestamp,
  startTimestampMs,
  ref,
}: Props) {
  const organization = useOrganization();

  const {eventId, groupId, groupShortId, level, projectSlug} = frame.data;
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

  const linkToEvent = (children: ReactNode) =>
    eventUrl ? <Link to={eventUrl}>{children}</Link> : children;

  return (
    <TimelineRow
      ref={ref}
      className={className}
      data-index={dataIndex}
      onMouseEnter={() => onMouseEnter(frame)}
      onMouseLeave={() => onMouseLeave(frame)}
    >
      <SimpleTable.RowCell>
        <Text ellipsis>{linkToEvent(getShortEventId(eventId || ''))}</Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text ellipsis>
          {linkToEvent(
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
      </SimpleTable.RowCell>
      <SimpleTable.RowCell gap="xs">
        <ProjectAvatar project={project!} size={16} />
        <Text ellipsis>
          {linkToEvent(
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
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text ellipsis>{linkToEvent(level)}</Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <TimestampButton
          onClick={event => {
            event.stopPropagation();
            onClickTimestamp(frame);
          }}
          startTimestampMs={startTimestampMs}
          timestampMs={frame.timestampMs}
        />
      </SimpleTable.RowCell>
    </TimelineRow>
  );
}
