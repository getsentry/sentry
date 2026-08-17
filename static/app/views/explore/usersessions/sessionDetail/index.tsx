import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  USER_SESSIONS_SUB_PATH,
  USER_SESSIONS_TITLE,
} from 'sentry/views/explore/usersessions/settings';
import {TopBar} from 'sentry/views/navigation/topBar';

import {SessionCounts} from './sessionCounts';
import {SessionTimeline} from './sessionTimeline';
import {MAX_ROWS_PER_DATASET, useSessionDetail} from './useSessionDetail';

export default function SessionDetailView() {
  const organization = useOrganization();
  const {sessionId} = useParams<{sessionId: string}>();
  const {
    counts,
    totalEvents,
    items,
    isTruncated,
    isPending,
    isError,
    dateParams,
    sortDirection,
    toggleSort,
  } = useSessionDetail(sessionId);

  return (
    <SentryDocumentTitle title={t('Session %s', sessionId)} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AnalyticsArea name="explore.usersessions.detail">
          <Stack flex={1}>
            <TopBar.Slot name="title">
              <Breadcrumbs
                crumbs={[
                  {
                    to: `/organizations/${organization.slug}/explore/${USER_SESSIONS_SUB_PATH}/`,
                    label: USER_SESSIONS_TITLE,
                    preservePageFilters: true,
                  },
                  {label: sessionId},
                ]}
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

                  <SessionIdRow>
                    <SessionIdText>{sessionId}</SessionIdText>
                    <CopyToClipboardButton
                      text={sessionId}
                      size="zero"
                      variant="transparent"
                      aria-label={t('Copy session ID')}
                    />
                  </SessionIdRow>

                  <SessionCounts
                    counts={counts}
                    totalEvents={totalEvents}
                    isPending={isPending}
                  />

                  {isTruncated && (
                    <Alert variant="info">
                      {tct(
                        'This timeline shows at most [limit] items per telemetry type, so it may be incomplete. The counts above are exact.',
                        {limit: MAX_ROWS_PER_DATASET}
                      )}
                    </Alert>
                  )}

                  <SessionTimeline
                    items={items}
                    isPending={isPending}
                    isError={isError}
                    dateParams={dateParams}
                    sortDirection={sortDirection}
                    onToggleSort={toggleSort}
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

const SessionIdRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const SessionIdText = styled('code')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;
