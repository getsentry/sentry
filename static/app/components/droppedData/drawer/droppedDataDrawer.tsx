import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DroppedDataChart} from 'sentry/components/droppedData/drawer/droppedDataChart';
import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {
  droppedEventsToOutcomeSections,
  type ReasonRow,
} from 'sentry/components/droppedData/drawer/outcomeSections';
import {
  getOutcomeColors,
  isOutcomeSelected,
  type OutcomeSelection,
} from 'sentry/components/droppedData/outcomes';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';

interface DroppedDataDrawerProps {
  dataset: DiscoverDatasets;
  interval?: string;
  onInvestigate?: (row: ReasonRow) => void;
}

export function DroppedDataDrawer({
  dataset,
  interval,
  onInvestigate,
}: DroppedDataDrawerProps) {
  const theme = useTheme();
  const [chartInterval] = useChartInterval();
  const {droppedEvents, acceptedEvents, isPending, isError, refetch} = useDroppedData({
    dataset,
    interval: interval ?? chartInterval,
  });

  const sections = useMemo(
    () => droppedEventsToOutcomeSections(droppedEvents ?? [], acceptedEvents ?? []),
    [droppedEvents, acceptedEvents]
  );
  const outcomeColors = useMemo(
    () =>
      getOutcomeColors(
        sections.map(section => section.outcome),
        theme
      ),
    [sections, theme]
  );

  const [outcomeSelection, setOutcomeSelection] = useState<OutcomeSelection>({});
  const selectedSections = useMemo(
    () =>
      sections.filter(section => isOutcomeSelected(outcomeSelection, section.outcome)),
    [sections, outcomeSelection]
  );

  return (
    <Fragment>
      <DrawerHeader>
        <Text size="md" variant="muted">
          {t('Dropped Data')}
        </Text>
      </DrawerHeader>
      <DrawerBody>
        {isError ? (
          <LoadingError
            message={t('There was an error loading dropped data.')}
            onRetry={() => void refetch()}
          />
        ) : isPending ? (
          <LoadingIndicator />
        ) : (
          <Stack gap="xl">
            <DroppedDataChart
              droppedEvents={droppedEvents ?? []}
              colors={outcomeColors}
              selection={outcomeSelection}
              onSelectionChange={setOutcomeSelection}
            />
            <DroppedDataOutcomeList
              sections={selectedSections}
              colors={outcomeColors}
              onInvestigate={onInvestigate}
            />
          </Stack>
        )}
      </DrawerBody>
    </Fragment>
  );
}
