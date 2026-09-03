import {useMemo} from 'react';
import styled from '@emotion/styled';

import {InfoTip} from '@sentry/scraps/info';
import {Grid, Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

import {unrecognizedKeys} from './queryRouting';
import {SessionSearchBar} from './sessionSearchBar';
import {USER_SESSIONS_TITLE} from './settings';
import {UserSessionsTable} from './userSessionsTable';
import {useSessionAttributes} from './useSessionAttributes';
import {useSessionsSearchQuery} from './useSessionsSearchQuery';
import {useUserSessions} from './useUserSessions';

export default function UserSessionsView() {
  const organization = useOrganization();
  const [query, setQuery] = useSessionsSearchQuery();
  const attributes = useSessionAttributes();
  const {sessions, isPending, isError} = useUserSessions({
    query,
    knownKeys: attributes.knownKeys,
    knownKeysLoading: attributes.isLoading,
  });

  // Keys no dataset recognizes are the usual reason a filter returns nothing, and
  // they look like missing data unless we say so.
  const unknownKeys = useMemo(
    () => (attributes.isLoading ? [] : unrecognizedKeys(query, attributes.knownKeys)),
    [attributes.isLoading, attributes.knownKeys, query]
  );

  return (
    <SentryDocumentTitle title={USER_SESSIONS_TITLE} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AnalyticsArea name="explore.usersessions">
          <Stack flex={1}>
            <TopBar.Slot name="title">
              {USER_SESSIONS_TITLE}
              <InfoTip
                title={t(
                  'Distinct session.id values seen across logs, metrics, traces and errors, most recently active first.'
                )}
              />
            </TopBar.Slot>

            <Layout.Body>
              <Layout.Main width="full">
                <Stack gap="xl">
                  <Grid
                    gap="md"
                    columns={{
                      'screen:sm': '1fr',
                      'screen:md': 'minmax(300px, auto) 1fr',
                    }}
                  >
                    <StyledPageFilterBar condensed>
                      <ProjectPageFilter />
                      <EnvironmentPageFilter />
                      <DatePageFilter />
                    </StyledPageFilterBar>
                    <SessionSearchBar
                      attributes={attributes}
                      query={query}
                      onSearch={setQuery}
                    />
                  </Grid>
                  <UserSessionsTable
                    sessions={sessions}
                    isPending={isPending}
                    isError={isError}
                    query={query}
                    unrecognizedKeys={unknownKeys}
                  />
                </Stack>
              </Layout.Main>
            </Layout.Body>
          </Stack>
        </AnalyticsArea>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;
