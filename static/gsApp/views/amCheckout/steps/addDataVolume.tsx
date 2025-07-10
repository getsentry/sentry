import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {PlanTier} from 'getsentry/types';
import {isAmPlan} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import VolumeSliders from 'getsentry/views/amCheckout/steps/volumeSliders';
import type {StepProps} from 'getsentry/views/amCheckout/types';

function AddDataVolume({
  isActive,
  organization,
  subscription,
  activePlan,
  checkoutTier,
  stepNumber,
  isCompleted,
  formData,
  onEdit,
  onUpdate,
  onCompleteStep,
}: StepProps) {
  useEffect(() => {
    if (organization && isActive) {
      trackGetsentryAnalytics('checkout.data_sliders_viewed', {
        organization,
      });
    }
  }, [organization, isActive]);

  const isLegacy =
    !checkoutTier ||
    !isAmPlan(checkoutTier) ||
    [PlanTier.AM2, PlanTier.AM1].includes(checkoutTier ?? PlanTier.AM3);

  const title = isLegacy ? t('Reserved Volumes') : t('Set Reserved Volumes (Optional)');
  const testId = 'reserved-volumes';

  const renderInfo = () => {
    if (isLegacy) {
      return null;
    }

    return (
      <InfoContainer>
        <RowWithTag>
          <LargeTitle>{t('Monthly Reserved Volumes')}</LargeTitle>
          <StyledTag type="promotion">{t('Plan ahead and save 20%')}</StyledTag>
        </RowWithTag>
        <Description>
          {t('Prepay for usage by reserving volumes and save up to 20%')}
        </Description>
      </InfoContainer>
    );
  };

  const renderBody = () => (
    <PanelBody data-test-id={`${testId}-body`}>
      <VolumeSliders
        checkoutTier={checkoutTier}
        activePlan={activePlan}
        organization={organization}
        onUpdate={onUpdate}
        formData={formData}
        subscription={subscription}
        isLegacy={isLegacy}
      />
    </PanelBody>
  );

  const renderFooter = () => (
    <StepFooter isLegacy={isLegacy} data-test-id={`${testId}-footer`}>
      {isLegacy && (
        <div>
          {tct('Need more data? Add On-Demand Budget, or [link:Contact Sales]', {
            link: <a href="mailto:sales@sentry.io" />,
          })}
        </div>
      )}
      <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
        {t('Continue')}
      </Button>
    </StepFooter>
  );

  return (
    <Panel data-test-id="step-add-data-volume">
      <StepHeader
        canSkip
        title={title}
        isActive={isActive}
        stepNumber={stepNumber}
        isCompleted={isCompleted}
        onEdit={onEdit}
      />
      {isActive && renderInfo()}
      {isActive && renderBody()}
      {isActive && renderFooter()}
    </Panel>
  );
}

export default AddDataVolume;

// footer
const StepFooter = styled(PanelFooter)<{isLegacy: boolean}>`
  padding: ${space(2)};
  display: grid;
  grid-template-columns: ${p => (p.isLegacy ? 'auto max-content' : 'none')};
  gap: ${space(1)};
  align-items: center;
  justify-content: ${p => (p.isLegacy ? 'normal' : 'end')};
`;

const RowWithTag = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-bottom: ${space(1)};
`;

const StyledTag = styled(Tag)`
  justify-content: center;
`;

const Title = styled('label')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSize.lg};
  margin: 0;
`;

const LargeTitle = styled(Title)`
  font-size: ${p => p.theme.fontSize.lg};
  line-height: normal;
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  margin: 0;
`;

const InfoContainer = styled('div')`
  padding: ${space(2)};
`;
