import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Divider} from 'sentry/views/issueDetails/divider';

interface DroppedDataPanelProps {
  onClose: () => void;
}

export function DroppedDataPanelContent({onClose}: DroppedDataPanelProps) {
  return (
    <Stack>
      <Flex align="center" gap="xl" padding="lg 2xl" borderBottom="primary">
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
    </Stack>
  );
}
