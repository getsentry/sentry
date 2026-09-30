import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';

interface InvitationAccountBadgeProps {
  onSwitchAccount: () => void;
  user: AvatarUser;
}

export function InvitationAccountBadge({
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
      <UserBadge user={user} avatarSize={40} flex="1" minWidth="0" />
      <Button size="xs" variant="transparent" onClick={onSwitchAccount}>
        {t('Switch account')}
      </Button>
    </Flex>
  );
}
