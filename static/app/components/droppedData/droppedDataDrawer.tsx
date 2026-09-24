import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Text} from '@sentry/scraps/text';

import {DroppedDataChart} from 'sentry/components/droppedData/droppedDataChart';
import {t} from 'sentry/locale';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

interface DroppedDataDrawerProps {
  droppedDataAnnotations: Annotation[];
}

export function DroppedDataDrawer({droppedDataAnnotations}: DroppedDataDrawerProps) {
  return (
    <Fragment>
      <DrawerHeader>
        <Text size="md" variant="muted">
          {t('Dropped Data')}
        </Text>
      </DrawerHeader>
      <DrawerBody>
        <DroppedDataChart annotations={droppedDataAnnotations} />
      </DrawerBody>
    </Fragment>
  );
}
