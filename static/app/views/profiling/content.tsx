import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client, ResponseMeta} from 'sentry/api';
import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, PageFilters} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {ProfilingScatterChart} from './landing/profilingScatterChart';
import {ProfilingTable} from './landing/profilingTable';

type RequestState = 'initial' | 'loading' | 'resolved' | 'errored';

function fetchProfiles(
  api: Client,
  cursor: string | undefined,
  organization: Organization,
  selection: PageFilters
): Promise<[Trace[], string | undefined, ResponseMeta | undefined]> {
  return api.requestPromise(`/organizations/${organization.slug}/profiling/profiles/`, {
    method: 'GET',
    includeAllArgs: true,
    query: {
      cursor,
      project: selection.projects,
    },
  });
}

interface ProfilingContentProps {
  location: Location;
  selection?: PageFilters;
}

function ProfilingContent({location, selection}: ProfilingContentProps) {
  const [requestState, setRequestState] = useState<RequestState>('initial');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [pageLinks, setPageLinks] = useState<string | null>(null);
  const organization = useOrganization();
  const cursor = decodeScalar(location.query.cursor);

  const api = useApi();

  useEffect(() => {
    if (!defined(selection)) {
      return;
    }

    api.clear();
    setRequestState('loading');

    fetchProfiles(api, cursor, organization, selection)
      .then(([_traces, , response]) => {
        setTraces(_traces);
        setPageLinks(response?.getResponseHeader('Link') ?? null);
        setRequestState('resolved');
      })
      .catch(() => setRequestState('errored'));
  }, [api, cursor, organization, selection]);

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
                  <Alert type="error" icon={<IconFlag size="md" />}>
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
