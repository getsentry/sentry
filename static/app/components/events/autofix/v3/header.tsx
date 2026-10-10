import {DrawerHeader} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AutofixReferrerInfoTip} from 'sentry/components/events/autofix/v3/autofixReferrerInfoTip';
import {
  SeerPanelActions,
  type SeerPanelActionsProps,
} from 'sentry/components/events/autofix/v3/seerPanelActions';
import {t} from 'sentry/locale';

interface SeerPanelHeaderProps extends SeerPanelActionsProps {
  referrer?: string;
}

function SeerPanelHeader({referrer, ...actions}: SeerPanelHeaderProps) {
  return (
    <Flex justify="between" width="100%">
      <Flex align="center" gap="xs">
        <Text>{t('Seer Autofix')}</Text>
        <AutofixReferrerInfoTip referrer={referrer} />
      </Flex>
      <SeerPanelActions {...actions} />
    </Flex>
  );
}

export function SeerDrawerHeader(props: SeerPanelHeaderProps) {
  return (
    <DrawerHeader hideBar hideCloseButtonText>
      <SeerPanelHeader {...props} />
    </DrawerHeader>
  );
}
