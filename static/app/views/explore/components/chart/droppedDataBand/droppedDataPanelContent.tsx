import {Fragment} from 'react';

import {DrawerBody, DrawerHeader, useDrawerContentContext} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Divider} from 'sentry/views/issueDetails/divider';

export function DroppedDataPanelContent() {
  const {onClose} = useDrawerContentContext();

  return (
    <Fragment>
      <DrawerHeader hideCloseButton>
        <Flex align="center" gap="xl">
          <Flex align="center" gap="sm" onClick={onClose} style={{cursor: 'pointer'}}>
            <IconClose size="xs" />
            <Text size="md" variant="muted">
              {t('Close')}
            </Text>
          </Flex>
          <Divider />
          <Text size="md" variant="muted">
            {t('Dropped Data')}
          </Text>
        </Flex>
      </DrawerHeader>
      <DrawerBody />
    </Fragment>
  );
}
