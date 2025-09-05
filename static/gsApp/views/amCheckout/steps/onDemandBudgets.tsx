import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import Panel from 'sentry/components/panels/panel';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {OnDemandBudgets} from 'getsentry/types';
import {OnDemandBudgetMode} from 'getsentry/types';
import {isDeveloperPlan} from 'getsentry/utils/billing';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import {getReservedPriceCents} from 'getsentry/views/amCheckout/utils';
import OnDemandBudgetEdit from 'getsentry/views/onDemandBudgets/onDemandBudgetEdit';
import {
  convertOnDemandBudget,
  getTotalBudget,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';

type Props = StepProps;

function OnDemandBudgetsStep(props: Props) {
  const [isUpdated, setIsUpdated] = useState(false);

  const title = t('On-Demand Budgets');

  const setBudgetMode = (nextMode: OnDemandBudgetMode) => {
    const {formData, subscription, onUpdate} = props;

    const currentOnDemandBudget = parseOnDemandBudgetsFromSubscription(subscription);
    const onDemandBudget = formData.onDemandBudget!;
    if (nextMode === onDemandBudget.budgetMode) {
      return;
    }
    if (nextMode === OnDemandBudgetMode.SHARED) {
      const nextOnDemandBudget = convertOnDemandBudget(currentOnDemandBudget, nextMode);

      onUpdate({
        onDemandBudget: nextOnDemandBudget,
        onDemandMaxSpend: getTotalBudget(nextOnDemandBudget),
      });
      return;
    }
    if (nextMode === OnDemandBudgetMode.PER_CATEGORY) {
      const nextOnDemandBudget = convertOnDemandBudget(currentOnDemandBudget, nextMode);

      onUpdate({
        onDemandBudget: nextOnDemandBudget,
        onDemandMaxSpend: getTotalBudget(nextOnDemandBudget),
      });
      return;
    }
  };

  const renderBody = () => {
    const {subscription, activePlan, formData, onUpdate, organization} = props;

    let currentOnDemandBudget: OnDemandBudgets;
    let formOnDemandBudget: OnDemandBudgets;
    if (isDeveloperPlan(subscription.planDetails) && !isUpdated) {
      currentOnDemandBudget = {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget:
          getReservedPriceCents({plan: activePlan, reserved: formData.reserved}) * 3,
      };
      formOnDemandBudget = currentOnDemandBudget;
    } else {
      currentOnDemandBudget = parseOnDemandBudgetsFromSubscription(subscription);
      formOnDemandBudget = formData.onDemandBudget!;
    }

    const onDemandEnabled = getTotalBudget(currentOnDemandBudget) > 0;
    const onDemandSupported = activePlan.allowOnDemand && subscription.supportsOnDemand;

    return (
      <OnDemandBudgetEdit
        onDemandEnabled={onDemandEnabled}
        onDemandSupported={onDemandSupported}
        currentBudgetMode={currentOnDemandBudget.budgetMode}
        onDemandBudget={formOnDemandBudget}
        setBudgetMode={setBudgetMode}
        setOnDemandBudget={(onDemandBudget: OnDemandBudgets) => {
          setIsUpdated(true);
          onUpdate({
            onDemandBudget,
            onDemandMaxSpend: getTotalBudget(onDemandBudget),
          });
        }}
        activePlan={activePlan}
        organization={organization}
        subscription={subscription}
      />
    );
  };

  const renderFooter = () => {
    const {stepNumber, onCompleteStep} = props;

    return (
      <StepFooter data-test-id={title}>
        <div>
          {tct('Need more info? [link:See on-demand pricing chart]', {
            link: (
              <ExternalLink href="https://docs.sentry.io/pricing/legacy-pricing/#per-category-pricing" />
            ),
          })}
        </div>
        <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
          {t('Continue')}
        </Button>
      </StepFooter>
    );
  };

  const {subscription, activePlan, formData, onUpdate, isActive, stepNumber, isCompleted, onEdit} =
    props;

  useEffect(() => {
    if (isDeveloperPlan(subscription.planDetails) && !isUpdated) {
      const nextOnDemandBudget = {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget:
          getReservedPriceCents({plan: activePlan, reserved: formData.reserved}) * 3,
      };
      setIsUpdated(true);
      onUpdate({
        onDemandBudget: nextOnDemandBudget,
        onDemandMaxSpend: nextOnDemandBudget.sharedMaxBudget,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription.planDetails, activePlan, formData.reserved, isUpdated]);

  return (
    <Panel>
      <StepHeader
        canSkip
        title={title}
        isActive={isActive}
        stepNumber={stepNumber}
        isCompleted={isCompleted}
        onEdit={onEdit}
      />
      {isActive && renderBody()}
      {isActive && renderFooter()}
    </Panel>
  );
}

const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(1)};
  align-items: center;
`;

export default OnDemandBudgetsStep;
