import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {t, tct} from 'sentry/locale';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {PlanTier} from 'getsentry/types';
import {displayBudgetName, isAmPlan} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';
import VolumeSliders from 'getsentry/views/amCheckout/components/volumeSliders';
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
        isNewCheckout: false,
      });
    }
  }, [organization, isActive]);

  const isLegacy =
    !checkoutTier ||
    !isAmPlan(checkoutTier) ||
    [PlanTier.AM2, PlanTier.AM1].includes(checkoutTier ?? PlanTier.AM3);

  const title = isLegacy ? t('Reserved Volumes') : t('Set Reserved Volumes (optional)');
  const testId = 'reserved-volumes';

  const renderInfo = () => {
    if (isLegacy) {
      return null;
    }

    return (
      <Flex direction="column" padding="xl" gap="0">
        <RowWithTag>
          <Title>{t('Monthly Reserved Volumes')}</Title>
          <StyledTag variant="promotion">{t('Plan ahead and save 20%')}</StyledTag>
        </RowWithTag>
        <Description>
          {t('Prepay for usage by reserving volumes and save up to 20%')}
        </Description>
      </Flex>
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
          {tct('Need more data? Add [budgetTerm], or [link:Contact Sales]', {
            budgetTerm: displayBudgetName(activePlan, {title: true, withBudget: true}),
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
      {isActive && (
        <Fragment>
          {renderInfo()}
          {renderBody()}
          {renderFooter()}
        </Fragment>
      )}
    </Panel>
  );
}

export default AddDataVolume;

// footer
const StepFooter = styled(PanelFooter)<{isLegacy: boolean}>`
  padding: ${p => p.theme.space.xl};
  display: grid;
  grid-template-columns: ${p => (p.isLegacy ? 'auto max-content' : 'none')};
  gap: ${p => p.theme.space.md};
  align-items: center;
  justify-content: ${p => (p.isLegacy ? 'normal' : 'end')};
`;

const RowWithTag = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const StyledTag = styled(Tag)`
  justify-content: center;
`;

const Title = styled('label')`
  font-weight: 600;
  margin: 0;
  line-height: normal;
  font-size: ${p => p.theme.fontSize.lg};
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  margin: 0;
`;
