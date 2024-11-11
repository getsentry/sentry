import {Fragment} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {useUpdateOrganization} from 'sentry/views/settings/dynamicSampling/utils/useUpdateOrganization';

const switchToManualMessage = tct(
  'Switching to manual mode disables automatic adjustments. After the switch, you can configure individual sample rates for each project. Dynamic sampling priorities continue to apply within the projects. [link:Learn more]',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
    ),
  }
);

const switchToAutoMessage = tct(
  'Switching to automatic mode enables continuous adjustments for your projects based on a global target sample rate. Sentry boosts the sample rates of small projects and ensures equal visibility. [link:Learn more]',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
    ),
  }
);

export function SamplingModeField() {
  const {samplingMode} = useOrganization();
  const hasAccess = useHasDynamicSamplingWriteAccess();

  const {mutate: updateOrganization, isPending} = useUpdateOrganization({
    onMutate: () => {
      addLoadingMessage(t('Switching sampling mode...'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Changes applied.'));
    },
    onError: () => {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    },
  });

  const handleSwitchMode = () => {
    openConfirmModal({
      confirmText: t('Switch Mode'),
      cancelText: t('Cancel'),
      header: (
        <h5>
          {samplingMode === 'organization'
            ? t('Switch to Manual Mode')
            : t('Switch to Automatic Mode')}
        </h5>
      ),
      message: (
        <Fragment>
          <p>
            {samplingMode === 'organization'
              ? switchToManualMessage
              : switchToAutoMessage}
          </p>
          {samplingMode === 'organization' ? (
            <p>{t('You can switch back to automatic mode at any time.')}</p>
          ) : (
            <p>
              {tct(
                'By switching [strong:you will lose your manually configured sample rates].',
                {
                  strong: <strong />,
                }
              )}
            </p>
          )}
        </Fragment>
      ),
      onConfirm: () => {
        updateOrganization({
          samplingMode: samplingMode === 'organization' ? 'project' : 'organization',
        });
      },
    });
  };

  return (
    <FieldGroup
      disabled={!hasAccess}
      label={t('Sampling Mode')}
      help={t('The current operating mode for dynamic sampling.')}
    >
      <ControlWrapper>
        <SegmentedControl
          disabled={!hasAccess || isPending}
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
                title={tct(
                  'Automatic mode allows you to set a target sample rate for your organization. Sentry automatically adjusts individual project rates to boost small projects and ensure equal visibility. [link:Learn more]',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                    ),
                  }
                )}
              />
            </LabelWrapper>
          </SegmentedControl.Item>
          <SegmentedControl.Item key="project" textValue={t('Manual')}>
            <LabelWrapper>
              {t('Manual')}
              <QuestionTooltip
                isHoverable
                size="sm"
                title={tct(
                  'Manual mode allows you to set fixed sample rates for each project. [link:Learn more]',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                    ),
                  }
                )}
              />
            </LabelWrapper>
          </SegmentedControl.Item>
        </SegmentedControl>
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
