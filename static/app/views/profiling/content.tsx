import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client, ResponseMeta} from 'sentry/api';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, PageFilters} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {ProfilingScatterChart} from './landing/profilingScatterChart';
import {ProfilingTable} from './landing/profilingTable';

interface ProfilingContentProps {
  location: Location;
  selection?: PageFilters;
}

function fetchProfiles(
  api: Client,
  location: Location,
  organization: Organization,
  selection: PageFilters
) {
  const promise: Promise<[Trace[], string | undefined, ResponseMeta | undefined]> =
    api.requestPromise(`/organizations/${organization.slug}/profiling/profiles/`, {
      method: 'GET',
      includeAllArgs: true,
      query: {
        cursor: location.query.cursor,
        project: selection.projects,
      },
    });

  promise.catch(() => {
    addErrorMessage(t('Unable to load profiles'));
  });

  return promise;
}

function ProfilingContent({location, selection}: ProfilingContentProps) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [pageLinks, setPageLinks] = useState<string | null>(null);
  const organization = useOrganization();
  const dateSelection = normalizeDateTimeParams(location.query);

  const api = useApi();

  useEffect(() => {
    if (!defined(selection)) {
      return;
    }

    api.clear();
    setLoading(true);

    fetchProfiles(api, location, organization, selection).then(
      ([_traces, , response]) => {
        setTraces(_traces);
        setPageLinks(response?.getResponseHeader('Link') ?? null);
        setLoading(false);
      }
    );
  }, [api, location, organization, selection]);

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
                <ProfilingScatterChart
                  {...dateSelection}
                  traces={traces}
                  loading={loading}
                  reloading={loading}
                />
                <ProfilingTable loading={loading} location={location} traces={traces} />
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
