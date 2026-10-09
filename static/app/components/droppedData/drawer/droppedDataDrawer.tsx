import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DroppedDataChart} from 'sentry/components/droppedData/drawer/droppedDataChart';
import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {droppedEventsToOutcomeSections} from 'sentry/components/droppedData/drawer/outcomeSections';
import {getOutcomeColors} from 'sentry/components/droppedData/outcomes';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

interface DroppedDataDrawerProps {
  dataset: DiscoverDatasets;
  interval?: string;
  onInvestigate?: () => void;
}

function DroppedDataDrawerInner({
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

  useLLMContext({
    contextHint:
      'Sentry dropped-data panel. drops are the events Sentry dropped for this ' +
      'dataset over the current date range, grouped by outcome then reason, each ' +
      'with its event count and share of total (accepted + dropped) events.',
    dataset,
    drops: sections,
  });

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
            />
            <DroppedDataOutcomeList
              sections={sections}
              colors={outcomeColors}
              onInvestigate={onInvestigate}
            />
          </Stack>
        )}
      </DrawerBody>
    </Fragment>
  );
}

export const DroppedDataDrawer = registerLLMContext(
  'dropped-data',
  DroppedDataDrawerInner
);
