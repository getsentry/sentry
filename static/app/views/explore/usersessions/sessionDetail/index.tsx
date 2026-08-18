import {useCallback} from 'react';
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
import {Version} from 'sentry/components/version';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SessionBadge} from 'sentry/views/explore/usersessions/sessionBadge';
import {
  USER_SESSIONS_SUB_PATH,
  USER_SESSIONS_TITLE,
} from 'sentry/views/explore/usersessions/settings';
import {TopBar} from 'sentry/views/navigation/topBar';

import {useSessionItemDrawer} from './detailPanel/useSessionItemDrawer';
import {SessionRail} from './sessionRail';
import {SessionScrubber} from './sessionScrubber';
import {TimelineFilters} from './timelineFilters';
import {useSelectedItem} from './useSelectedItem';
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
    eventsByKey,
    eventsByType,
    filters,
    isFiltered,
    isTruncated,
    isPending,
    isError,
    dateParams,
    sortDirection,
    toggleSort,
    truncatedByType,
    window,
    setWindow,
  } = useSessionDetail(sessionId);

  const selection = useSelectedItem({eventsByKey});
  useSessionItemDrawer({
    selection,
    selectedEvent: selection.selectedEvent,
    bounds,
    dateParams,
    isPending,
  });

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
      counts={counts}
      eventsByType={eventsByType}
      truncatedByType={truncatedByType}
      selectedTypes={filters.types}
      onToggleType={toggleType}
      window={window}
      onChangeWindow={setWindow}
      selectedKey={selection.selectedKey}
      onSelectItem={selection.toggleItem}
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

                  <Flex align="center" gap="md">
                    {/* The handle names the session; the full id is what other tools
                        take, so it stays one click away, against the handle. */}
                    <SessionBadge
                      name={name}
                      isPending={isPending}
                      action={
                        <CopyToClipboardButton
                          text={sessionId}
                          size="zero"
                          variant="transparent"
                          aria-label={t('Copy session ID')}
                        />
                      }
                      trailing={
                        name.release ? (
                          // Releases are often raw shas, and nothing reads forty
                          // characters of one. The short form carries the full
                          // value in its tooltip.
                          <Text size="sm" variant="muted" wrap="nowrap">
                            <Version
                              version={name.release}
                              anchor={false}
                              tooltipRawVersion
                            />
                          </Text>
                        ) : null
                      }
                    />
                    <Flex flex="1" />
                    {/* The scrubber's lane counts are the breakdown, and they scope
                        to whatever window is selected. This one stays the whole
                        session's size — the denominator those lanes read against. */}
                    <CountPill radius="full" padding="sm xl">
                      <Flex align="baseline" gap="xs">
                        <Text size="sm" variant="muted">
                          {t('Items')}
                        </Text>
                        <Text size="sm" bold tabular>
                          {isPending ? '—' : formatAbbreviatedNumber(totalEvents)}
                        </Text>
                      </Flex>
                    </CountPill>
                  </Flex>

                  {isTruncated && (
                    <Alert variant="info">
                      {t(
                        'This timeline caps how many items it loads per telemetry type, so it may be incomplete. The lane counts are exact for the whole session.'
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
                    />
                    <Separator orientation="horizontal" border="primary" />
                    <SessionRail
                      items={items}
                      bounds={bounds}
                      isFiltered={isFiltered}
                      isWindowed={window !== null}
                      isPending={isPending}
                      isError={isError}
                      dateParams={dateParams}
                      selectedKey={selection.selectedKey}
                      onSelect={selection.toggleItem}
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

/**
 * The embossed tokens the design system's own pills are built from. Reaching for
 * them directly rather than for `Chip`, which carries the border and the drop
 * shadow but also means "search filter token" everywhere else in the app.
 */
const CountPill = styled(Container)`
  border: 1px solid ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
  box-shadow: 0 1px 0 0 ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
`;
