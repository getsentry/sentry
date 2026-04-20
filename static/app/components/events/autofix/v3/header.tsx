import {useMemo} from 'react';

import {Button} from '@sentry/scraps/button';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AutofixFeedback} from 'sentry/components/events/autofix/autofixFeedback';
import {getReferrerConfig} from 'sentry/components/events/autofix/autofixReferrer';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';

interface SeerDrawerHeaderProps {
  onCopyMarkdown?: () => void;
  onReset?: () => void;
  referrer?: string;
}

export function SeerDrawerHeader({
  onCopyMarkdown,
  onReset,
  referrer,
}: SeerDrawerHeaderProps) {
  const tooltip = useMemo(() => {
    const config = getReferrerConfig(referrer);
    return config.tooltip ?? referrer;
  }, [referrer]);

  return (
    <DrawerHeader>
      <Flex justify="between" width="100%">
        <Flex align="center" gap="xs">
          <Text>{t('Seer Autofix')}</Text>
          {tooltip && <InfoTip title={tooltip} size="xs" />}
          <Button
            size="xs"
            icon={<IconCopy />}
            onClick={onCopyMarkdown}
            disabled={!onCopyMarkdown}
            tooltipProps={{title: t('Copy analysis as Markdown')}}
            aria-label={t('Copy analysis as Markdown')}
            priority="transparent"
          />
          <Button
            size="xs"
            icon={<IconRefresh />}
            onClick={onReset}
            disabled={!onReset}
            tooltipProps={{title: t('Start a new analysis from scratch')}}
            aria-label={t('Start a new analysis from scratch')}
            priority="transparent"
          />
        </Flex>
        <AutofixFeedback iconOnly priority="transparent" />
      </Flex>
    </DrawerHeader>
  );
}
