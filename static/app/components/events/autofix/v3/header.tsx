import {useMemo} from 'react';

import {Button} from '@sentry/scraps/button';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {getReferrerConfig} from 'sentry/components/events/autofix/autofixReferrer';
import {IconBot} from 'sentry/icons/iconBot';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SeerDrawerHeaderProps {
  enableBashTools?: boolean;
  onCopyMarkdown?: () => void;
  onEnableBashToolsChange?: (enabled: boolean) => void;
  onOpenSeerAgent?: () => void;
  onReset?: () => void;
  referrer?: string;
}

export function SeerDrawerHeader({
  enableBashTools,
  onCopyMarkdown,
  onEnableBashToolsChange,
  onOpenSeerAgent,
  onReset,
  referrer,
}: SeerDrawerHeaderProps) {
  const organization = useOrganization();
  const hasDebugFlag = organization.features.includes('autofix-seer-agent-debug');
  const isSentryEmployee = useIsSentryEmployee();
  const tooltip = useMemo(() => {
    const config = getReferrerConfig(referrer);
    return config.tooltip ?? referrer;
  }, [referrer]);

  return (
    <DrawerHeader hideBar hideCloseButtonText>
      <Flex justify="between" width="100%">
        <Flex align="center" gap="xs">
          <Text>{t('Seer Autofix')}</Text>
          {tooltip && <InfoTip title={tooltip} size="xs" />}
        </Flex>
        <Flex align="center" gap="xs">
          <Button
            size="xs"
            icon={<IconRefresh />}
            onClick={onReset}
            disabled={!onReset}
            tooltipProps={{title: t('Start a new analysis from scratch')}}
            aria-label={t('Start a new analysis from scratch')}
            variant="transparent"
          />
          <Button
            size="xs"
            icon={<IconCopy />}
            onClick={onCopyMarkdown}
            disabled={!onCopyMarkdown}
            tooltipProps={{title: t('Copy analysis as Markdown')}}
            aria-label={t('Copy analysis as Markdown')}
            variant="transparent"
          />
          {isSentryEmployee && onEnableBashToolsChange && (
            <Tooltip title={t('Enable bash mode for the autofix analysis')} skipWrapper>
              <Flex align="center" gap="xs">
                <Text size="xs">{t('Bash')}</Text>
                <Switch
                  size="sm"
                  checked={enableBashTools ?? false}
                  onChange={() => onEnableBashToolsChange(!enableBashTools)}
                  aria-label={t('Enable bash tools')}
                />
              </Flex>
            </Tooltip>
          )}
          {isSentryEmployee && hasDebugFlag && onOpenSeerAgent && (
            <Button
              size="xs"
              icon={<IconBot />}
              onClick={onOpenSeerAgent}
              tooltipProps={{title: t('Open in Seer Agent (debug)')}}
              aria-label={t('Open in Seer Agent (debug)')}
              variant="transparent"
            />
          )}
        </Flex>
      </Flex>
    </DrawerHeader>
  );
}
