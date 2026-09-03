import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {Version} from 'sentry/components/version';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {SessionBadge} from 'sentry/views/explore/usersessions/sessionBadge';
import {
  USER_SESSIONS_SUB_PATH,
  USER_SESSIONS_TITLE,
} from 'sentry/views/explore/usersessions/settings';
import {TopBar} from 'sentry/views/navigation/topBar';

import {useSessionItemDrawer} from './detailPanel/useSessionItemDrawer';
import {SessionHealthText} from './sessionHealth';
import {SessionRail} from './sessionRail';
import {SessionReplay} from './sessionReplay';
import {SessionScrubber} from './sessionScrubber';
import {SessionVitalsRow} from './sessionVitals';
import {TimelineFilters} from './timelineFilters';
import {useSelectedItem} from './useSelectedItem';
import {useSessionDetail} from './useSessionDetail';
import {useSessionHealth} from './useSessionHealth';
import {useSessionVitals} from './useSessionVitals';

export default function SessionDetailView() {
  const organization = useOrganization();
  const {sessionId} = useParams<{sessionId: string}>();
  const {
    bounds,
    counts,
    name,
    items,
    loadedEvents,
    eventsByKey,
    eventsByType,
    filters,
    idle,
    isFiltered,
    isTruncated,
    isPending,
    isError,
    dateParams,
    routes,
    services,
    skippedBandTraces,
    sortDirection,
    toggleSort,
    truncatedByType,
    window,
    setWindow,
  } = useSessionDetail(sessionId);

  const vitals = useSessionVitals(sessionId);
  // The error total comes from the count pass rather than a second query of its
  // own; only the unhandled half is new.
  const health = useSessionHealth({
    sessionId,
    errorCount: isPending ? undefined : counts.errors,
  });

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
    // Edge to edge like the chart it stands in for, so the panel does not
    // reflow inward once the real one lands.
    <Placeholder height="248px" />
  ) : bounds ? (
    <SessionScrubber
      bounds={bounds}
      counts={counts}
      eventsByType={eventsByType}
      idle={idle}
      routes={routes}
      services={services}
      skippedBandTraces={skippedBandTraces}
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
      {/*
        No filter bar. A session is already pinned to a project, an environment and
        its own span of time, so there was nothing here worth setting: two of the
        three could only subtract, and the third is worse than useless — a range
        landing inside the session clips the `min`/`max` aggregates `bounds` comes
        from, which moves the session's zero, so offsets, lane counts, the opening
        route and the health verdict all quietly describe a slice.

        Hidden rather than disconnected, for now. The params still scope every query
        through `usePageFilters`, they just have no control — so a session older than
        the persisted range still renders empty with nothing on screen to widen it.
        Cutting the dependency is the real fix: querying every project over the
        retention window broke the spans reads, so it is parked until that is pinned
        down rather than shipped on a guess.
      */}
      <PageFiltersContainer>
        <AnalyticsArea name="explore.usersessions.detail">
          {/*
            The page is sized to the viewport rather than to its content, so the
            only thing that scrolls is the rail. A session timeline is read
            against its chart — the swim lanes say where in the session you are —
            and a chart that scrolls off the top takes that reference with it.
          */}
          <ViewportConstrainedPage hideFooter>
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

            <Stack flex={1} minHeight="0" padding="lg xl" gap="xl">
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
                    <Fragment>
                      {name.release ? (
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
                      ) : null}
                      {/*
                        Last on the identity line, after the browser and the
                        release. How the session went is part of what it is, and a
                        coloured word there is enough to find a crashed session by
                        without giving one adjective a chip of its own.
                      */}
                      <SessionHealthText {...health} />
                    </Fragment>
                  }
                />
                <Flex flex="1" />
                {/*
                  Beside the session's name rather than over the timeline: how fast
                  this session felt to the person in it is part of who the session
                  is, not another lane of telemetry.

                  Health used to sit here as a pill too, and the item count before
                  that. Both left: health is one word and reads better on the
                  identity line above, and the count belongs to the rail's own
                  toolbar. What is left is the one thing here that is a measurement.
                */}
                <SessionVitalsRow {...vitals} />
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
                  loadedEvents={loadedEvents}
                  visibleEvents={items.length}
                  isPending={isPending}
                />
                <Separator orientation="horizontal" border="primary" />
                <SessionRail
                  items={items}
                  bounds={bounds}
                  isFiltered={isFiltered}
                  isWindowed={window !== null}
                  isPending={isPending}
                  isError={isError}
                  selectedKey={selection.selectedKey}
                  onSelect={selection.toggleItem}
                />
              </Panel>

              <SessionReplay sessionId={sessionId} />
            </Stack>
          </ViewportConstrainedPage>
        </AnalyticsArea>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

/**
 * Holds the chart, the filters and the rail as one column, and gives the rail
 * whatever height is left. `min-height: 0` is what lets it: without it a flex
 * item refuses to shrink below its content, so the rail would size to all four
 * thousand rows and push the page into scrolling after all.
 */
const Panel = styled(Container)`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;
