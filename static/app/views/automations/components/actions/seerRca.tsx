import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';

export function SeerRCA() {
  return t('Seer autofix trigger');
}

export function SeerRCANode() {
  return (
    <Flex gap="xs">
      <IconSeer />
      <Text>{t('Send to Seer for Root Cause Analysis.')}</Text>
    </Flex>
  );
}

export function validateSeerRCA() {
  return undefined;
}
