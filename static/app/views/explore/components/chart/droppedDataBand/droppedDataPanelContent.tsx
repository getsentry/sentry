import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {Divider} from 'sentry/views/issueDetails/divider';

interface DroppedDataPanelProps {
  onClose: () => void;
}

export function DroppedDataPanelContent({onClose}: DroppedDataPanelProps) {
  return (
    <Stack>
      <Flex
        align="center"
        gap="xl"
        paddingLeft="2xl"
        paddingTop="lg"
        paddingBottom="lg"
        borderBottom="primary"
      >
        <Button variant="transparent" size="sm" icon={<IconClose />} onClick={onClose}>
          Close
        </Button>
        <Divider />
        <Text size="md">Dropped Data</Text>
      </Flex>
    </Stack>
  );
}
