import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export function DroppedDataPanelContent() {
  return (
    <Fragment>
      <DrawerHeader>
        <Text size="md" variant="muted">
          {t('Dropped Data')}
        </Text>
      </DrawerHeader>
      <DrawerBody />
    </Fragment>
  );
}
