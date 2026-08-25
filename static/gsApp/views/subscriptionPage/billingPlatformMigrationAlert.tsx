import {Alert} from '@sentry/scraps/alert';
import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {Subscription} from 'getsentry/types';

interface Props {
  subscription: Subscription;
}

export function BillingPlatformMigrationAlert({subscription}: Props) {
  const organization = useOrganization();
  const isSentryEmployee = useIsSentryEmployee();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:billing-platform-migrated-alert`,
  });

  if (!subscription.hasMigratedToBillingPlatform || !isSentryEmployee || isDismissed) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert
        variant="info"
        trailingItems={
          <Button
            icon={<IconClose />}
            onClick={dismiss}
            size="zero"
            variant="transparent"
            aria-label={t('Dismiss banner')}
          />
        }
      >
        <Flex align="center" gap="sm">
          <FeatureBadge type="experimental" />
          <Text>{t('This organization is migrated to the billing platform.')}</Text>
        </Flex>
      </Alert>
    </Alert.Container>
  );
}
