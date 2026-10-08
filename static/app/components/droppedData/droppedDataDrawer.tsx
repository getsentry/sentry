import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  DroppedDataCategoryList,
  droppedEventsToCategorySections,
} from 'sentry/components/droppedData/droppedDataCategoryList';
import {DroppedDataChart} from 'sentry/components/droppedData/droppedDataChart';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
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
  const [chartInterval] = useChartInterval();
  const {droppedEvents, acceptedEvents, isPending} = useDroppedData({
    dataset,
    interval: interval ?? chartInterval,
  });

  useLLMContext({
    contextHint:
      'Sentry dropped-data panel. drops are the events Sentry dropped for this ' +
      'dataset over the current date range, grouped by outcome then reason, each ' +
      'with its event count and share of total (accepted + dropped) events.',
    dataset,
    drops: droppedEventsToCategorySections(droppedEvents ?? [], acceptedEvents ?? []),
  });

  return (
    <Fragment>
      <DrawerHeader>
        <Text size="md" variant="muted">
          {t('Dropped Data')}
        </Text>
      </DrawerHeader>
      <DrawerBody>
        {isPending ? (
          <LoadingIndicator />
        ) : (
          <Stack gap="xl">
            <DroppedDataChart droppedEvents={droppedEvents ?? []} />
            <DroppedDataCategoryList
              droppedEvents={droppedEvents ?? []}
              acceptedEvents={acceptedEvents ?? []}
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
