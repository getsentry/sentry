import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {PageFilters} from 'sentry/types';
import {useProfiles} from 'sentry/utils/profiling/hooks/useProfiles';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {ProfilingScatterChart} from './landing/profilingScatterChart';
import {ProfilingTable} from './landing/profilingTable';

interface ProfilingContentProps {
  location: Location;
  selection?: PageFilters;
}

function ProfilingContent({location, selection}: ProfilingContentProps) {
  const organization = useOrganization();
  const cursor = decodeScalar(location.query.cursor);
  const [requestState, traces, pageLinks] = useProfiles({cursor, selection});

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
                {requestState === 'errored' && (
                  <Alert type="error" showIcon>
                    {t('Unable to load profiles')}
                  </Alert>
                )}
                <ProfilingScatterChart
                  datetime={
                    selection?.datetime ?? {
                      start: null,
                      end: null,
                      period: null,
                      utc: null,
                    }
                  }
                  traces={traces}
                  isLoading={requestState === 'loading'}
                />
                <ProfilingTable
                  isLoading={requestState === 'loading'}
                  error={requestState === 'errored' ? t('Unable to load profiles') : null}
                  location={location}
                  traces={traces}
                />
                <Pagination pageLinks={pageLinks} />
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

export default withPageFilters(ProfilingContent);
