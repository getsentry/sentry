import styled from '@emotion/styled';

import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {SegmentedControl} from 'sentry/components/segmentedControl';
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

export function SamplingModeField({initialTargetRate}: Props) {
  const {samplingMode} = useOrganization();
  const hasAccess = useHasDynamicSamplingWriteAccess();

  const handleSwitchMode = () => {
    openSamplingModeSwitchModal({
      samplingMode: samplingMode === 'organization' ? 'project' : 'organization',
      initialTargetRate,
    });
  };

  return (
    <FieldGroup
      disabledReason={t('You do not have permission to change this setting.')}
      disabled={!hasAccess}
      label={t('Sampling Mode')}
      help={t('The current operating mode for dynamic sampling.')}
    >
      <ControlWrapper>
        <Tooltip
          disabled={hasAccess}
          title={t('You do not have permission to change this setting.')}
        >
          <SegmentedControl
            disabled={!hasAccess}
            label={t('Sampling mode')}
            value={samplingMode}
            onChange={handleSwitchMode}
          >
            <SegmentedControl.Item key="organization" textValue={t('Automatic')}>
              <LabelWrapper>
                {t('Automatic')}
                <QuestionTooltip
                  isHoverable
                  size="sm"
                  title={
                    hasAccess &&
                    tct(
                      'Automatic mode allows you to set a target sample rate for your organization. Sentry automatically adjusts individual project rates to boost small projects and ensure equal visibility. [link:Learn more]',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                        ),
                      }
                    )
                  }
                />
              </LabelWrapper>
            </SegmentedControl.Item>
            <SegmentedControl.Item key="project" textValue={t('Manual')}>
              <LabelWrapper>
                {t('Manual')}
                <QuestionTooltip
                  isHoverable
                  size="sm"
                  title={
                    hasAccess &&
                    tct(
                      'Manual mode allows you to set fixed sample rates for each project. [link:Learn more]',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                        ),
                      }
                    )
                  }
                />
              </LabelWrapper>
            </SegmentedControl.Item>
          </SegmentedControl>
        </Tooltip>
      </ControlWrapper>
    </FieldGroup>
  );
}

const ControlWrapper = styled('div')`
  width: max-content;
`;

const LabelWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
