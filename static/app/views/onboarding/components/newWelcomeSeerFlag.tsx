import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';

export function NewWelcomeSeerFlag() {
  return (
    <Flex gap="md" align="center">
      <IconInfo legacySize="16px" variant="secondary" />
      <Container>
        <Text variant="muted" size="sm" density="comfortable" bold>
          {t('Requires additional setup')}
        </Text>
      </Container>
    </Flex>
  );
}
