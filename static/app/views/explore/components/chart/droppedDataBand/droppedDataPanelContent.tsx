import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

import {DroppedDataChart} from './droppedDataChart';

interface DroppedDataPanelContentProps {
  droppedDataAnnotations: Annotation[];
}

export function DroppedDataPanelContent({
  droppedDataAnnotations,
}: DroppedDataPanelContentProps) {
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
