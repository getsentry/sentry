import {Flex} from '@sentry/scraps/layout';

import {ExternalLink} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
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

  const handleSwitchMode = () => {
    openSamplingModeSwitchModal({
      samplingMode: samplingMode === 'organization' ? 'project' : 'organization',
      initialTargetRate,
    });
  };

  return (
    <Flex as="label" align="center" gap="md" marginBottom="0">
      <Tooltip
        title={tct(
          'Manually specify the percentage of incoming traffic that should be stored for each project. [link:Read the docs]',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/organization/dynamic-sampling/#advanced-mode" />
            ),
          }
        )}
        showUnderline
      >
        {t('Advanced Mode')}
      </Tooltip>
      <Tooltip
        disabled={hasAccess}
        title={t('You do not have permission to change this setting.')}
      >
        <Switch
          size="lg"
          onChange={handleSwitchMode}
          disabled={!hasAccess}
          checked={samplingMode === 'project'}
        />
      </Tooltip>
    </Flex>
  );
}
