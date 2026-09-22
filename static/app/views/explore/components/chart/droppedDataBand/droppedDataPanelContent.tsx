import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

import {DroppedDataChart} from './droppedDataChart';

interface DroppedDataPanelContentProps {
  droppedData: Annotation[];
}

export function DroppedDataPanelContent({droppedData}: DroppedDataPanelContentProps) {
  return (
    <Fragment>
      <DrawerHeader>
        <Text size="md" variant="muted">
          {t('Dropped Data')}
        </Text>
      </DrawerHeader>
      <DrawerBody>
        <DroppedDataChart annotations={droppedData} />
      </DrawerBody>
    </Fragment>
  );
}
