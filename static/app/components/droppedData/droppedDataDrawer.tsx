import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DroppedDataCategoryList} from 'sentry/components/droppedData/droppedDataCategoryList';
import {DroppedDataChart} from 'sentry/components/droppedData/droppedDataChart';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';

interface DroppedDataDrawerProps {
  dataset: DiscoverDatasets;
  interval?: string;
}

export function DroppedDataDrawer({dataset, interval}: DroppedDataDrawerProps) {
  const [chartInterval] = useChartInterval();
  const {droppedEvents, acceptedEvents, isPending} = useDroppedData({
    dataset,
    interval: interval ?? chartInterval,
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
            />
          </Stack>
        )}
      </DrawerBody>
    </Fragment>
  );
}
