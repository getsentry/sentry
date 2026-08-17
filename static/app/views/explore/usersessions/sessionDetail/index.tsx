import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SessionBadge} from 'sentry/views/explore/usersessions/sessionBadge';
import {
  USER_SESSIONS_SUB_PATH,
  USER_SESSIONS_TITLE,
} from 'sentry/views/explore/usersessions/settings';
import {TopBar} from 'sentry/views/navigation/topBar';

import {SessionCounts} from './sessionCounts';
import {SessionRail} from './sessionRail';
import {SessionScrubber} from './sessionScrubber';
import {TimelineFilters} from './timelineFilters';
import {useSessionDetail} from './useSessionDetail';

export default function SessionDetailView() {
  const organization = useOrganization();
  const {sessionId} = useParams<{sessionId: string}>();
  const {
    bounds,
    counts,
    name,
    totalEvents,
    items,
    filters,
    isFiltered,
    isTruncated,
    isPending,
    isError,
    dateParams,
    sortDirection,
    toggleSort,
    timestampsByType,
    truncatedByType,
    window,
    setWindow,
  } = useSessionDetail(sessionId);

  // A view preference, not a filter: it changes how the rail is drawn, not which
  // items it contains, so it stays out of the URL alongside the rest.
  const [collapseQuiet, setCollapseQuiet] = useState(true);

  const toggleType = useCallback(
    (key: (typeof filters.types)[number]) => {
      const next = filters.types.includes(key)
        ? filters.types.filter(type => type !== key)
        : [...filters.types, key];
      filters.setTypes(next);
    },
    [filters]
  );

  // Reserved while loading so the rail does not jump down the page once the
  // session's extent arrives. A session with no telemetry at all has no extent to
  // draw, and gets no strip.
  const scrubber = isPending ? (
    <Container padding="lg xl">
      <Placeholder height="216px" />
    </Container>
  ) : bounds ? (
    <SessionScrubber
      bounds={bounds}
      timestampsByType={timestampsByType}
      truncatedByType={truncatedByType}
      selectedTypes={filters.types}
      onToggleType={toggleType}
      window={window}
      onChangeWindow={setWindow}
    />
  ) : null;

  return (
    // The handle rather than the subject: it comes from the id, so it is stable
    // from first paint instead of flashing "Anonymous" until the queries land.
    <SentryDocumentTitle title={t('Session %s', name.handle)} orgSlug={organization.slug}>
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
                  {label: name.handle},
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

                  <Flex align="center" gap="sm">
                    <SessionBadge
                      name={name}
                      isPending={isPending}
                      trailing={
                        name.release ? (
                          <Text size="sm" variant="muted" ellipsis>
                            {name.release}
                          </Text>
                        ) : null
                      }
                    />
                    {/* The handle names the session; the full id is what other
                        tools take, so it stays one click away. */}
                    <CopyToClipboardButton
                      text={sessionId}
                      size="zero"
                      variant="transparent"
                      aria-label={t('Copy session ID')}
                    />
                  </Flex>

                  <SessionCounts
                    counts={counts}
                    totalEvents={totalEvents}
                    isPending={isPending}
                  />

                  {isTruncated && (
                    <Alert variant="info">
                      {t(
                        'This timeline caps how many items it loads per telemetry type, so it may be incomplete. The counts above are exact.'
                      )}
                    </Alert>
                  )}

                  {/*
                    Scrubber, controls and rail read as one instrument: the strip
                    aims, the rail is what it aims at, so they share a frame rather
                    than sitting in separate cards.
                  */}
                  <Panel radius="md" border="primary" background="primary">
                    {scrubber}
                    {scrubber && <Separator orientation="horizontal" border="primary" />}
                    <TimelineFilters
                      filters={filters}
                      sortDirection={sortDirection}
                      onToggleSort={toggleSort}
                      collapseQuiet={collapseQuiet}
                      onToggleCollapseQuiet={setCollapseQuiet}
                    />
                    <Separator orientation="horizontal" border="primary" />
                    <SessionRail
                      items={items}
                      bounds={bounds}
                      collapseQuiet={collapseQuiet}
                      isFiltered={isFiltered}
                      isWindowed={window !== null}
                      isPending={isPending}
                      isError={isError}
                      dateParams={dateParams}
                    />
                  </Panel>
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

const Panel = styled(Container)`
  overflow: hidden;
`;
