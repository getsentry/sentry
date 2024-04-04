import {useState} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import AiAnalyticsFilters from 'sentry/views/ai-analytics/filters';

type Props = {
  children: React.ReactNode;
  organization: Organization;
};

function AiAnalyticsContainer({organization, children}: Props) {
  const [search, setSearch] = useState('');

  function renderNoAccess() {
    return (
      <Layout.Page withPadding>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Layout.Page>
    );
  }

  return (
    <Feature
      features="ai-analytics"
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
      <Layout.Page>
        <StyledBody>
          <StyledMain>
            <PageFiltersContainer>
              <AiAnalyticsFilters onSearch={x => setSearch(x)} query={search} />
            </PageFiltersContainer>
          </StyledMain>
        </StyledBody>
      </Layout.Page>
    </Feature>
  );
}

const StyledBody = styled('div')`
  background-color: ${p => p.theme.background};

  flex: 1;
  display: grid;
  gap: 0;
  padding: 0;

  grid-template-rows: 1fr;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'content saved-searches';
`;

const StyledMain = styled('section')`
  grid-area: content;
  padding: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(3)} ${space(4)};
  }
`;

export default withOrganization(AiAnalyticsContainer);
