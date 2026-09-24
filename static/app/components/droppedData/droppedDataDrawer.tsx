import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DroppedDataCategoryList} from 'sentry/components/droppedData/droppedDataCategoryList';
import {DroppedDataChart} from 'sentry/components/droppedData/droppedDataChart';
import {t} from 'sentry/locale';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

interface DroppedDataDrawerProps {
  acceptedAnnotations: Annotation[];
  droppedAnnotations: Annotation[];
}

export function DroppedDataDrawer({
  droppedAnnotations,
  acceptedAnnotations,
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
          <DroppedDataChart droppedAnnotations={droppedAnnotations} />
          <DroppedDataCategoryList
            droppedAnnotations={droppedAnnotations}
            acceptedAnnotations={acceptedAnnotations}
          />
        </Stack>
      </DrawerBody>
    </Fragment>
  );
}
