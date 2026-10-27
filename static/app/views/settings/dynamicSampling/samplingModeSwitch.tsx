import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Switch} from '@sentry/scraps/switch';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {openSamplingModeSwitchModal} from 'sentry/views/settings/dynamicSampling/samplingModeSwitchModal';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';

interface Props {
  /**
   * The initial target rate for the automatic sampling mode.
   */
  initialTargetRate?: number;
}

export function SamplingModeSwitch({initialTargetRate}: Props) {
  const {samplingMode} = useOrganization();
  const hasAccess = useHasDynamicSamplingWriteAccess();
  // Advanced Mode can no longer be entered. An organization already in it can still leave it.
  const isInAdvancedMode = samplingMode === 'project';

  const handleSwitchMode = () => {
    openSamplingModeSwitchModal({
      samplingMode: 'organization',
      initialTargetRate,
    });
  };

  const disabledReason = isInAdvancedMode
    ? t('You do not have permission to change this setting.')
    : t(
        'Advanced Mode is no longer available. Sample rates are configured for the whole organization.'
      );

  return (
    <Flex as="label" align="center" gap="md" marginBottom="0">
      <InfoText
        variant="inherit"
        title={tct(
          'Manually specify the percentage of incoming traffic that should be stored for each project. [link:Read the docs]',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/organization/dynamic-sampling/#advanced-mode" />
            ),
          }
        )}
      >
        {t('Advanced Mode')}
      </InfoText>
      <Tooltip disabled={hasAccess && isInAdvancedMode} title={disabledReason}>
        <Switch
          size="lg"
          onChange={handleSwitchMode}
          disabled={!hasAccess || !isInAdvancedMode}
          checked={isInAdvancedMode}
        />
      </Tooltip>
    </Flex>
  );
}
