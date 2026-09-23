import {useMemo} from 'react';

import {DrawerHeader} from '@sentry/scraps/drawer';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getReferrerConfig} from 'sentry/components/events/autofix/autofixReferrer';
import {
  SeerPanelActions,
  type SeerPanelActionsProps,
} from 'sentry/components/events/autofix/v3/seerPanelActions';
import {t} from 'sentry/locale';

interface SeerPanelHeaderProps extends SeerPanelActionsProps {
  referrer?: string;
}

function SeerPanelHeader({referrer, ...actions}: SeerPanelHeaderProps) {
  const tooltip = useMemo(() => {
    const config = getReferrerConfig(referrer);
    return config.tooltip ?? referrer;
  }, [referrer]);

  return (
    <Flex justify="between" width="100%">
      <Flex align="center" gap="xs">
        <Text>{t('Seer Autofix')}</Text>
        {tooltip && <InfoTip title={tooltip} size="xs" />}
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
