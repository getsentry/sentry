import {Flex} from '@sentry/scraps/layout';

import CircleIndicator from 'sentry/components/circleIndicator';
import {t} from 'sentry/locale';

interface AuthenticatorHeaderProps {
  isActive: boolean;
  name: string;
}

export function AuthenticatorHeader({name, isActive}: AuthenticatorHeaderProps) {
  return (
    <Flex align="center" gap="md">
      <CircleIndicator
        role="status"
        aria-label={
          isActive
            ? t('Authentication Method Active')
            : t('Authentication Method Inactive')
        }
        enabled={isActive}
      />
      {name}
    </Flex>
  );
}
