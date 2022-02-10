import styled from '@emotion/styled';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PageHeading from 'sentry/components/pageHeading';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import useOrganization from 'sentry/utils/useOrganization';

import {ProfileScatterChart} from './landing/chart';
import {ProfileTable} from './landing/table';

interface Props {
  location: Location;
}

function ProfilingContent({location}: Props) {
  const organization = useOrganization();
  const dateSelection = normalizeDateTimeParams(location.query);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <StyledPageContent>
            <Layout.Header>
              <Layout.HeaderContent>
                <StyledHeading>{t('Profiling')}</StyledHeading>
              </Layout.HeaderContent>
            </Layout.Header>
            <Layout.Body>
              <Layout.Main fullWidth>
                <ProfileScatterChart {...dateSelection} traces={[]} />
                <ProfileTable location={location} traces={[]} />
              </Layout.Main>
            </Layout.Body>
          </StyledPageContent>
        </NoProjectMessage>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
`;

export default ProfilingContent;
