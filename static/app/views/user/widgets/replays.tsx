import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Avatar from 'sentry/components/avatar';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {t} from 'sentry/locale';
import {space, ValidSize} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  ActivityCell,
  BrowserCell,
  DurationCell,
  OSCell,
} from 'sentry/views/replays/replayTable/tableCell';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

import {ReplayPlayer} from './replayPlayer';
import { UserParams } from '../types';

type Props = Partial<UserParams>;

export function ReplayWidget({userKey, userValue}: Props) {
  if (!userKey || !userValue) {
    return null;
  }

  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();
  const {projects} = useProjects();
  const projectsHash = Object.fromEntries(projects.map(project => [project.id, project]));

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue(`user.${userKey}`, userValue);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'activity',
          'browser.name',
          'browser.version',
          'count_dead_clicks',
          'count_errors',
          'count_rage_clicks',
          'duration',
          'finished_at',
          'id',
          'is_archived',
          'os.name',
          'os.version',
          'project_id',
          'started_at',
          'urls',
          'user',
        ],
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
  }, [location, userKey, userValue]);

  const {
    replays,
    pageLinks: _pageLinks,
    isFetching,
    fetchError,
  } = useReplayList({
    eventView,
    location,
    organization,
    perPage: 4,
  });

  return (
    <ReplayPanel>
      {isFetching ? (
        <Placeholder height="189px" />
      ) : fetchError ? (
        <div>Error fetching replays</div>
      ) : (
        <ReplayLayout>
          {!replays?.length ? (
            t('No replays created')
          ) : (
            <Fragment>
              <ReplayPlayer replaySlug={replays[0].id} />
              <TableWrapper>
                <Table>
                  {replays.slice(1).map(replay => {
                    const project = projectsHash[replay.project_id];

                    return (
                      <Fragment key={replay.id}>
                        <Cols key={`${replay.id}-replay`}>
                          <Title>
                            <Link
                              to={`/organizations/${organization.slug}/replays/${replay.id}/`}
                            >
                              {getShortEventId(replay.id)}
                            </Link>
                          </Title>
                          <SubRow gap={1}>
                            <Row gap={0.5}>
                              <SmallOSCell key={`${replay.id}-os`} replay={replay} />
                              <SmallBrowserCell key="browser" replay={replay} />
                            </Row>

                            <Row gap={0.5}>
                              {project ? <Avatar size={12} project={project} /> : null}
                              {project ? project.slug : null}
                            </Row>
                            <Row gap={0.5}>
                              <IconCalendar color="gray300" size="xs" />
                              <TextOverflow>
                                <TimeSince date={replay.started_at} />
                              </TextOverflow>
                            </Row>
                          </SubRow>
                        </Cols>
                        <SmallDurationCell
                          key={`${replay.id}-duration`}
                          replay={replay}
                        />
                        <SmallActivityCell
                          key={`${replay.id}-activity`}
                          replay={replay}
                        />
                      </Fragment>
                    );
                  })}
                </Table>
              </TableWrapper>
            </Fragment>
          )}
        </ReplayLayout>
      )}
    </ReplayPanel>
  );
}

const ReplayLayout = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const TableWrapper = styled('div')`
  flex-shrink: 0;
  overflow: auto;
`;
const Table = styled('div')`
  display: grid;
  overflow: hidden;
  gap: ${space(1.5)};
  grid-template-columns: auto max-content max-content;
  align-items: center;
  padding: ${space(1)} ${space(2)};
  flex-shrink: 0;
`;

const Cols = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  width: 100%;
`;

const Row = styled('div')<{gap: ValidSize; minWidth?: number}>`
  display: flex;
  gap: ${p => space(p.gap)};
  align-items: center;
  ${p => (p.minWidth ? `min-width: ${p.minWidth}px;` : '')}
`;

const SubRow = styled(Row)`
  color: ${p => p.theme.gray300};
`;

const ReplayPanel = styled(Panel)`
  flex: 1;
  overflow: hidden;
`;

const Title = styled('div')`
  display: flex;
  gap: ${space(0.25)};
`;

const SmallOSCell = styled(OSCell)`
  padding: 0;
`;

const SmallDurationCell = styled(DurationCell)`
  padding: 0;
`;

const SmallBrowserCell = styled(BrowserCell)`
  padding: 0;
`;

const SmallActivityCell = styled(ActivityCell)`
  padding: 0;
`;
