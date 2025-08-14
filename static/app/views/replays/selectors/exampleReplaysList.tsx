import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import AnalyticsArea from 'sentry/components/analyticsArea';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ReplaySessionColumn} from 'sentry/components/replays/table/replayTableColumns';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useOrganization from 'sentry/utils/useOrganization';
import {StatusContainer} from 'sentry/views/profiling/landing/styles';

export default function ExampleReplaysList({
  location,
  clickType,
  selectorQuery,
  projectId,
}: {
  clickType: 'count_dead_clicks' | 'count_rage_clicks';
  location: Location;
  projectId: number;
  selectorQuery: string;
}) {
  const organization = useOrganization();
  const {project, environment, start, statsPeriod, utc, end} = location.query;
  const emptyLocation: Location = useMemo(() => {
    return {
      pathname: '',
      search: '',
      hash: '',
      state: '',
      action: 'PUSH' as const,
      key: '',
      query: {project, environment, start, statsPeriod, utc, end},
    };
  }, [project, environment, start, statsPeriod, utc, end]);

  const eventView = useMemo(
    () =>
      EventView.fromNewQueryWithLocation(
        {
          id: '',
          name: '',
          version: 2,
          fields: [
            'activity',
            'duration',
            'id',
            'project_id',
            'user',
            'finished_at',
            'is_archived',
            'started_at',
          ],
          projects: [projectId],
          query: selectorQuery,
          orderby: `-${clickType}`,
        },
        emptyLocation
      ),
    [emptyLocation, selectorQuery, clickType, projectId]
  );

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location: emptyLocation,
    organization,
    perPage: 3,
  });

  return (
    <Fragment>
      {fetchError || (!isFetching && !replays?.length) ? (
        <EmptyStateWarning withIcon={false} small>
          {t('No replays found')}
        </EmptyStateWarning>
      ) : isFetching ? (
        <StatusContainer>
          <LoadingIndicator />
        </StatusContainer>
      ) : (
        <AnalyticsArea name="example-replays-list">
          {replays?.map(replay => {
            return (
              <Wrapper key={replay.id}>
                <ReplaySessionColumn.Component
                  columnIndex={0}
                  replay={replay}
                  rowIndex={0}
                  showDropdownFilters={false}
                />
              </Wrapper>
            );
          })}
        </AnalyticsArea>
      )}
    </Fragment>
  );
}

const Wrapper = styled('div')`
  padding: ${space(0.75)} ${space(1.5)} ${space(1.5)} ${space(1.5)};
`;
