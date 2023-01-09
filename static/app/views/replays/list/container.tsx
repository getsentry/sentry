import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {t} from 'sentry/locale';
import ReplaysList from 'sentry/views/replays/list/replays';

function ReplaysListContainer() {
  return (
    <Fragment>
      <Layout.Header>
        <StyledLayoutHeaderContent>
          <StyledHeading>
            {t('Replays')} <ReplaysFeatureBadge space={1} />
          </StyledHeading>
        </StyledLayoutHeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <ReplaysList />
      </PageFiltersContainer>
    </Fragment>
  );
}

const StyledLayoutHeaderContent = styled(Layout.HeaderContent)`
  display: flex;
  justify-content: space-between;
  flex-direction: row;
`;

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
  display: flex;
`;

export default ReplaysListContainer;
