import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';

interface AccountBadgeProps {
  onSwitchAccount: () => void;
  user: AvatarUser;
  disabled?: boolean;
  isSwitchingAccount?: boolean;
}

export function AccountBadge({
  disabled = false,
  isSwitchingAccount = false,
  onSwitchAccount,
  user,
}: AccountBadgeProps) {
  return (
    <Flex
      align="center"
      justify="between"
      gap="lg"
      border="secondary"
      radius="md"
      padding="lg"
    >
      <UserBadge user={user} avatarSize={32} flex="1" minWidth="0" />
      <Button
        size="xs"
        variant="transparent"
        busy={isSwitchingAccount}
        disabled={disabled || isSwitchingAccount}
        onClick={onSwitchAccount}
      >
        {t('Switch account')}
      </Button>
    </Flex>
  );
}
