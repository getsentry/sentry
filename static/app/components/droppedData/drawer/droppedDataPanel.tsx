import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Container, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading} from '@sentry/scraps/text';

import {
  droppedEventsToOutcomeGroups,
  filterDroppedEventsByScope,
  type AskSeerHandler,
  type DroppedDataScope,
} from 'sentry/components/droppedData/outcomeSections';
import {
  useDroppedData,
  type UseDroppedDataParams,
} from 'sentry/components/droppedData/useDroppedData';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';

import {DroppedDataChart} from './droppedDataChart';
import {DroppedDataOutcomeList} from './droppedDataOutcomeList';
import {
  getOutcomeColors,
  isOutcomeSelected,
  type OutcomeSelection,
} from './outcomeColors';

interface DroppedDataPanelProps extends UseDroppedDataParams {
  onScopeChange: (scope: DroppedDataScope) => void;
  scope: DroppedDataScope;
  source: DroppedDataAnalyticsSource;
  onAskSeer?: AskSeerHandler;
}

export function DroppedDataPanel({
  dataset,
  interval,
  projects,
  scope,
  source,
  onAskSeer,
  onScopeChange,
}: DroppedDataPanelProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {droppedEvents, acceptedEvents, isPending, isError, refetch} = useDroppedData({
    dataset,
    interval,
    projects,
  });

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

  if (isError) {
    return (
      <Container padding="xl 2xl">
        <LoadingError
          message={t('There was an error loading dropped events.')}
          onRetry={() => void refetch()}
        />
      </Container>
    );
  }

  if (isPending) {
    return (
      <Container padding="xl 2xl">
        <LoadingIndicator />
      </Container>
    );
  }

  if (scopedDroppedEvents.length === 0) {
    return (
      <Container padding="xl 2xl">
        {hasExpectedDrops ? (
          <EmptyState
            title={t('No unexpected drops.')}
            description={t(
              'All events dropped in this time range were expected, like sampling and inbound filters.'
            )}
            action={
              <Button size="sm" onClick={() => onScopeChange('all')}>
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
    );
  }

  return (
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
                  source,
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
              <Separator orientation="horizontal" borderColor="primary" />
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
  );
}
