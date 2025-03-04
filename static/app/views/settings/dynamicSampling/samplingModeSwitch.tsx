import styled from '@emotion/styled';

import {Switch} from 'sentry/components/core/switch';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
    <Wrapper>
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
          toggle={handleSwitchMode}
          isDisabled={!hasAccess}
          isActive={samplingMode === 'project'}
        />
      </Tooltip>
    </Wrapper>
  );
}

const Wrapper = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: 0;
`;
