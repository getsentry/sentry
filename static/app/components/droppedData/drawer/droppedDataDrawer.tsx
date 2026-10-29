import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {DrawerBody} from '@sentry/scraps/drawer';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {DrawerHeader} from 'sentry/components/drawer';
import {DroppedDataChart} from 'sentry/components/droppedData/drawer/droppedDataChart';
import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {
  getOutcomeColors,
  isOutcomeSelected,
  type OutcomeSelection,
} from 'sentry/components/droppedData/drawer/outcomeColors';
import {droppedAndFilteredLabel} from 'sentry/components/droppedData/outcomes';
import {
  droppedEventsToOutcomeGroups,
  filterDroppedEventsByScope,
  type AskSeerHandler,
  type DroppedDataScope,
} from 'sentry/components/droppedData/outcomeSections';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';

interface DroppedDataDrawerProps {
  dataset: DiscoverDatasets;
  interval?: string;
  onAskSeer?: AskSeerHandler;
}

export function DroppedDataDrawer({
  dataset,
  interval,
  onAskSeer,
}: DroppedDataDrawerProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const [chartInterval] = useChartInterval();
  const {droppedEvents, acceptedEvents, isPending, isError, refetch} = useDroppedData({
    dataset,
    interval: interval ?? chartInterval,
  });

  const [scope, setScope] = useState<DroppedDataScope>('unexpected');
  const [outcomeSelection, setOutcomeSelection] = useState<OutcomeSelection>({});

  const scopedDroppedEvents = filterDroppedEventsByScope(droppedEvents ?? [], scope);
  const hasExpectedDrops = scopedDroppedEvents.length < (droppedEvents?.length ?? 0);
  const groups = droppedEventsToOutcomeGroups(
    droppedEvents ?? [],
    acceptedEvents ?? [],
    scope
  );
  // Colored from every outcome so colors stay stable when the scope changes.
  const outcomeColors = getOutcomeColors(
    (droppedEvents ?? []).map(event => event.outcome),
    theme
  );
  const selectedUnintentional = groups.unintentional.filter(section =>
    isOutcomeSelected(outcomeSelection, section.outcome)
  );
  const selectedIntentional = groups.intentional.filter(section =>
    isOutcomeSelected(outcomeSelection, section.outcome)
  );

  return (
    <Fragment>
      <DrawerHeader>
        <Flex flex="1" align="center" justify="between" gap="md" paddingRight="lg">
          <Text size="md">{droppedAndFilteredLabel(dataset)}</Text>
          <SegmentedControl
            aria-label={t('Filter dropped events')}
            size="xs"
            value={scope}
            onChange={nextScope => {
              setScope(nextScope);
              trackAnalytics('explore.dropped_data.scope_toggled', {
                organization,
                dataset,
                scope: nextScope,
              });
            }}
          >
            <SegmentedControl.Item key="unexpected">
              {t('Unexpected')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="all">{t('All')}</SegmentedControl.Item>
          </SegmentedControl>
        </Flex>
      </DrawerHeader>
      <Stack minHeight={`calc(100% - ${PRIMARY_HEADER_HEIGHT}px)`} padding="0">
        {props => (
          <DrawerBody {...props}>
            {isError ? (
              <Container padding="xl 2xl">
                <LoadingError
                  message={t('There was an error loading dropped events.')}
                  onRetry={() => void refetch()}
                />
              </Container>
            ) : isPending ? (
              <Container padding="xl 2xl">
                <LoadingIndicator />
              </Container>
            ) : scopedDroppedEvents.length === 0 ? (
              <Container padding="xl 2xl">
                {hasExpectedDrops ? (
                  <EmptyState
                    title={t('No unexpected drops.')}
                    description={t(
                      'All events dropped in this time range were expected, like sampling and inbound filters.'
                    )}
                    action={
                      <Button size="sm" onClick={() => setScope('all')}>
                        {t('Show all drops')}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    title={t('No dropped or filtered events.')}
                    description={t('Nothing was dropped or filtered in this time range.')}
                  />
                )}
              </Container>
            ) : (
              <Fragment>
                <Container background="primary" padding="xl 3xl lg">
                  <DroppedDataChart
                    droppedEvents={scopedDroppedEvents}
                    colors={outcomeColors}
                    dataset={dataset}
                    hasAskSeer={onAskSeer !== undefined}
                    selection={outcomeSelection}
                    onSelectionChange={nextSelection => {
                      for (const [outcome, selected] of Object.entries(nextSelection)) {
                        if (isOutcomeSelected(outcomeSelection, outcome) !== selected) {
                          trackAnalytics('explore.dropped_data.legend_outcome_toggled', {
                            organization,
                            dataset,
                            outcome,
                            selected,
                          });
                        }
                      }
                      setOutcomeSelection(nextSelection);
                    }}
                  />
                </Container>
                <Stack flex="1" gap="2xl" background="secondary" padding="2xl xl">
                  {selectedUnintentional.length > 0 && (
                    <Stack gap="xl">
                      <Container padding="0 xl">
                        <Heading as="h3" size="xl">
                          {t('Unexpected Drops')}
                        </Heading>
                      </Container>
                      <DroppedDataOutcomeList
                        sections={selectedUnintentional}
                        onAskSeer={onAskSeer}
                      />
                    </Stack>
                  )}
                  {selectedIntentional.length > 0 && (
                    <Stack gap="xl">
                      <Stack gap="2xl">
                        <Separator orientation="horizontal" border="primary" />
                        <Container padding="0 xl">
                          <Heading as="h3" size="xl">
                            {t('Expected Drops')}
                          </Heading>
                        </Container>
                      </Stack>
                      <DroppedDataOutcomeList
                        sections={selectedIntentional}
                        onAskSeer={onAskSeer}
                      />
                    </Stack>
                  )}
                </Stack>
              </Fragment>
            )}
          </DrawerBody>
        )}
      </Stack>
    </Fragment>
  );
}
