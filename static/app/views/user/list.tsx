import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useUserPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useOrganization from 'sentry/utils/useOrganization';

function UserListContainer() {
  useUserPageview('replay.list-time-spent');
  const {slug: orgSlug} = useOrganization();

  return (
    <SentryDocumentTitle title={`User — ${orgSlug}`}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{t('User')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LayoutGap>N/A</LayoutGap>
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
export default UserListContainer;
