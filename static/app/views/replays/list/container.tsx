import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
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
          <StyledHeading>
            {t('Replays')} <ReplaysFeatureBadge space={1} />
          </StyledHeading>
        </Layout.HeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <ReplaysList />
      </PageFiltersContainer>
    </Fragment>
  );
}

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
`;

export default ReplaysListContainer;
