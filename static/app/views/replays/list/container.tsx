import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {t} from 'sentry/locale';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import ReplaysList from 'sentry/views/replays/list/replays';

function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Session Replay')} <ReplaysFeatureBadge space={1} />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <ReplaysList />
      </PageFiltersContainer>
    </Fragment>
  );
}

export default ReplaysListContainer;
