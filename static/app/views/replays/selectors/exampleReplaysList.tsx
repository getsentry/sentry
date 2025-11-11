import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import AnalyticsArea from 'sentry/components/analyticsArea';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout/flex';
import {Link} from 'sentry/components/core/link/link';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ReplayBadge from 'sentry/components/replays/replayBadge';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {useRoutes} from 'sentry/utils/useRoutes';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {ReplayListRecord} from 'sentry/views/replays/types';

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
  const routes = useRoutes();
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
    enabled: true,
    eventView,
    location: emptyLocation,
    organization,
    perPage: 3,
  });

  const referrer = getRouteStringFromRoutes(routes);
  const linkEventView = EventView.fromLocation(location);

  return (
    <Fragment>
      {fetchError || (!isFetching && !replays?.length) ? (
        <EmptyStateWarning withIcon={false} small>
          {t('No replays found')}
        </EmptyStateWarning>
      ) : isFetching ? (
        <Flex align="center" justify="center" flex={1} padding="md">
          <LoadingIndicatorNoMargin />
        </Flex>
      ) : (
        <AnalyticsArea name="example-replays-list">
          {replays?.map(replay => {
            return (
              <ListItem key={replay.id}>
                <ReplayListItem
                  replay={replay}
                  referrer={referrer}
                  linkEventView={linkEventView}
                />
                <InteractionStateLayer />
              </ListItem>
            );
          })}
        </AnalyticsArea>
      )}
    </Fragment>
  );
}

function ReplayListItem({
  replay,
  referrer,
  linkEventView,
}: {
  linkEventView: EventView;
  referrer: string;
  replay: ReplayListRecord;
}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: replay.project_id ?? undefined});

  return (
    <Link
      to={{
        pathname: makeReplaysPathname({
          path: `/${replay.id}/`,
          organization,
        }),
        query: {
          referrer,
          ...linkEventView.generateQueryStringObject(),
          f_b_type: 'rageOrDead',
        },
      }}
      onClick={() =>
        trackAnalytics('replay.list-navigate-to-details', {
          project_id: project?.id,
          platform: project?.platform,
          organization,
          referrer,
          referrer_table: 'selector-widget',
        })
      }
    >
      <Flex padding="md xl">
        <ReplayBadge replay={replay} />
      </Flex>
    </Link>
  );
}

const ListItem = styled('li')`
  position: relative;

  &:hover [data-underline-on-hover='true'] {
    text-decoration: underline;
  }
`;

const LoadingIndicatorNoMargin = styled(LoadingIndicator)`
  margin: 0;
`;
