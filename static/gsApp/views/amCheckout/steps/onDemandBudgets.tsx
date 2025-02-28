import {Component} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
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

type State = {
  // Once the on-demand budget is updated, we no longer suggest a new default on-demand value,
  // regardless of whether there are further changes in the reserved value.
  // This is because if the user has seen and updated or clicked "Continue",
  // that is considered the final on-demand value unless the user updates the value themselves.
  isUpdated: boolean;
};

class OnDemandBudgetsStep extends Component<Props> {
  constructor(props: Props) {
    super(props);
    this.state = {isUpdated: false};
  }

  state: State;

  get title() {
    return t('On-Demand Budgets');
  }

  setBudgetMode = (nextMode: OnDemandBudgetMode) => {
    const {formData, subscription, onUpdate} = this.props;

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

  renderBody = () => {
    const {subscription, activePlan, formData, onUpdate, organization} = this.props;

    let currentOnDemandBudget: OnDemandBudgets;
    let formOnDemandBudget: OnDemandBudgets;
    if (isDeveloperPlan(subscription.planDetails) && !this.state.isUpdated) {
      currentOnDemandBudget = {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget:
          getReservedPriceCents({plan: activePlan, reserved: formData.reserved}) * 3,
      };
      formOnDemandBudget = currentOnDemandBudget;
      this.setState({isUpdated: true});
      onUpdate({
        onDemandBudget: formOnDemandBudget,
        onDemandMaxSpend: formOnDemandBudget.sharedMaxBudget,
      });
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
        setBudgetMode={this.setBudgetMode}
        setOnDemandBudget={(onDemandBudget: OnDemandBudgets) => {
          this.setState({isUpdated: true});
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

  renderFooter = () => {
    const {stepNumber, onCompleteStep} = this.props;

    return (
      <StepFooter data-test-id={this.title}>
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

  render() {
    const {isActive, stepNumber, isCompleted, onEdit} = this.props;

    return (
      <Panel>
        <StepHeader
          canSkip
          title={this.title}
          isActive={isActive}
          stepNumber={stepNumber}
          isCompleted={isCompleted}
          onEdit={onEdit}
        />
        {isActive && this.renderBody()}
        {isActive && this.renderFooter()}
      </Panel>
    );
  }
}

const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(1)};
  align-items: center;
`;

export default OnDemandBudgetsStep;
