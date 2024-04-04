import {useState} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import AiAnalyticsFilters from 'sentry/views/aiAnalytics/filters';
import TokenUsageChart from 'sentry/views/aiAnalytics/tokenUsageChart';

function NoAccessComponent() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

function AiAnalyticsContainer() {
  const [search, setSearch] = useState('');
  const organization = useOrganization();
  return (
    <Feature
      features="ai-analytics"
      organization={organization}
      renderDisabled={NoAccessComponent}
    >
      <NoProjectMessage organization={organization}>
        <Layout.Page>
          <StyledBody>
            <StyledMain>
              <PageFiltersContainer>
                <AiAnalyticsFilters onSearch={x => setSearch(x)} query={search} />
              </PageFiltersContainer>
              <TwoColumns>
                <TokenUsageChart metric="ai.prompt_tokens.used" />
                <TokenUsageChart metric="ai.completion_tokens.used" />
              </TwoColumns>
            </StyledMain>
          </StyledBody>
        </Layout.Page>
      </NoProjectMessage>
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

const TwoColumns = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const StyledMain = styled('section')`
  grid-area: content;
  padding: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(3)} ${space(4)};
  }
`;

export default AiAnalyticsContainer;
