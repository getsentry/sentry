import {Fragment} from 'react';
import styled from '@emotion/styled';

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
          <CloseButton onClick={onClose}>
            <IconClose size="xs" />
            <Text size="md" variant="muted">
              {t('Close')}
            </Text>
          </CloseButton>
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

const CloseButton = styled('button')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
`;
