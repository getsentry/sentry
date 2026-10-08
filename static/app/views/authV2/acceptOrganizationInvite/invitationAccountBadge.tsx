import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';

interface InvitationAccountBadgeProps {
  onSwitchAccount: () => void;
  user: AvatarUser;
  isSwitchingAccount?: boolean;
}

export function InvitationAccountBadge({
  isSwitchingAccount = false,
  onSwitchAccount,
  user,
}: InvitationAccountBadgeProps) {
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
        disabled={isSwitchingAccount}
        onClick={onSwitchAccount}
      >
        {t('Switch account')}
      </Button>
    </Flex>
  );
}
