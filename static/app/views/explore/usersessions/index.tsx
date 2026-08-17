import styled from '@emotion/styled';

import {InfoTip} from '@sentry/scraps/info';
import {Stack} from '@sentry/scraps/layout';

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

import {USER_SESSIONS_TITLE} from './settings';
import {UserSessionsTable} from './userSessionsTable';
import {useUserSessions} from './useUserSessions';

export default function UserSessionsView() {
  const organization = useOrganization();
  const {sessions, isPending, isError} = useUserSessions();

  return (
    <SentryDocumentTitle title={USER_SESSIONS_TITLE} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AnalyticsArea name="explore.usersessions">
          <Stack flex={1}>
            <TopBar.Slot name="title">
              {USER_SESSIONS_TITLE}
              <InfoTip
                title={t(
                  'Distinct session.id values seen across logs, metrics, spans and errors, most recently active first.'
                )}
              />
            </TopBar.Slot>

            <Layout.Body>
              <Layout.Main width="full">
                <Stack gap="xl">
                  <StyledPageFilterBar condensed>
                    <ProjectPageFilter />
                    <EnvironmentPageFilter />
                    <DatePageFilter />
                  </StyledPageFilterBar>
                  <UserSessionsTable
                    sessions={sessions}
                    isPending={isPending}
                    isError={isError}
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
