import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export function WidgetNoDataPanel() {
  return (
    <Flex width="100%" flexGrow={1} align="center" justify="center">
      <Stack gap="sm" align="center">
        <Heading as="h3" size="lg" align="center">
          {t('No data to plot.')}
        </Heading>
        <Text as="p" size="md" variant="muted" align="center">
          {t('Try adjusting the filters.')}
        </Text>
      </Stack>
    </Flex>
  );
}
