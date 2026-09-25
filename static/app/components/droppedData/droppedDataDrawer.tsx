import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DroppedDataCategoryList} from 'sentry/components/droppedData/droppedDataCategoryList';
import {DroppedDataChart} from 'sentry/components/droppedData/droppedDataChart';
import {t} from 'sentry/locale';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

interface DroppedDataDrawerProps {
  acceptedDataAnnotations: Annotation[];
  droppedDataAnnotations: Annotation[];
}

export function DroppedDataDrawer({
  droppedDataAnnotations,
  acceptedDataAnnotations,
}: DroppedDataDrawerProps) {
  return (
    <Fragment>
      <DrawerHeader>
        <Text size="md" variant="muted">
          {t('Dropped Data')}
        </Text>
      </DrawerHeader>
      <DrawerBody>
        <Stack gap="xl">
          <DroppedDataChart droppedDataAnnotations={droppedDataAnnotations} />
          <DroppedDataCategoryList
            droppedDataAnnotations={droppedDataAnnotations}
            acceptedDataAnnotations={acceptedDataAnnotations}
          />
        </Stack>
      </DrawerBody>
    </Fragment>
  );
}
