import {Component} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {OnDemandBudgetMode, type OnDemandBudgets} from 'getsentry/types';
import {isBizPlanFamily, isDeveloperPlan} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import VolumeSliders from 'getsentry/views/amCheckout/steps/volumeSliders';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import PayAsYouGoBudgetEdit from 'getsentry/views/onDemandBudgets/payAsYouGoBudgetEdit';
import {getTotalBudget} from 'getsentry/views/onDemandBudgets/utils';

const PAYG_BUSINESS_DEFAULT = 30000;
const PAYG_TEAM_DEFAULT = 10000;

type Props = StepProps;

type State = {
  // Once the PAYG budget is updated, we no longer suggest a new default PAYG value
  isUpdated: boolean;
};

class SetBudgetAndReserves extends Component<Props, State> {
  state: State = {isUpdated: false};

  componentDidUpdate(prevProps: Props) {
    const {isActive, organization, subscription, activePlan} = this.props;

    // record when step is opened
    if (prevProps.isActive || !isActive) {
      return;
    }

    const hasPartnerMigrationFeature = organization?.features.includes(
      'partner-billing-migration'
    );

    // set default budget for new customers for the first time they complete plan selection
    if (
      (isDeveloperPlan(subscription.planDetails) || hasPartnerMigrationFeature) &&
      !this.state.isUpdated &&
      isActive
    ) {
      // Default shared budgets are hardcoded vs being a multiple of the plan's base price
      const defaultBudget = isBizPlanFamily(activePlan)
        ? PAYG_BUSINESS_DEFAULT
        : PAYG_TEAM_DEFAULT;
      this.handleBudgetChange({
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: defaultBudget,
      });
      this.setState({isUpdated: true});
    }

    if (organization) {
      trackGetsentryAnalytics('checkout.data_sliders_viewed', {
        organization,
      });
    }
  }

  get title() {
    return t('Set Your Pay-as-you-go Budget');
  }

  handleBudgetChange(value: OnDemandBudgets) {
    const {organization, subscription, onUpdate, formData} = this.props;

    // right now value is always a SharedOnDemandBudget but re-defining it here makes TS happy
    const budget = {
      budgetMode: value.budgetMode,
      sharedMaxBudget: getTotalBudget(value),
    };

    onUpdate({
      onDemandBudget: value,
      onDemandMaxSpend: budget.sharedMaxBudget,
    });

    if (organization) {
      trackGetsentryAnalytics('checkout.payg_changed', {
        organization,
        subscription,
        plan: formData.plan,
        cents: budget.sharedMaxBudget || 0,
      });
    }
  }

  renderBody = () => {
    const {formData, activePlan, checkoutTier, organization, onUpdate, subscription} =
      this.props;

    const budgetIsNotUnset =
      typeof formData.onDemandMaxSpend === 'number' && !isNaN(formData.onDemandMaxSpend);

    const paygBudget: OnDemandBudgets =
      budgetIsNotUnset && formData.onDemandBudget
        ? formData.onDemandBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY
          ? {
              budgetMode: OnDemandBudgetMode.SHARED,
              sharedMaxBudget: getTotalBudget(formData.onDemandBudget),
            }
          : formData.onDemandBudget
        : {budgetMode: OnDemandBudgetMode.SHARED, sharedMaxBudget: 0};

    return (
      <PanelBody data-test-id={this.title}>
        <PayAsYouGoBudgetEdit
          payAsYouGoBudget={paygBudget}
          setPayAsYouGoBudget={value => this.handleBudgetChange(value)}
        />
        <RowWithTag>
          <SectionHeader>
            <LargeTitle>
              {t('Set Reserved Volumes')}
              <OptionalText>{t(' (optional)')}</OptionalText>
              <QuestionTooltip
                title={t('Prepay for usage by reserving volumes and save up to 20%')}
                position="bottom"
                size="sm"
              />
            </LargeTitle>
          </SectionHeader>
          <Tag type="promotion">{t('Plan ahead and save 20%')}</Tag>
        </RowWithTag>
        <VolumeSliders
          checkoutTier={checkoutTier}
          activePlan={activePlan}
          organization={organization}
          onUpdate={onUpdate}
          formData={formData}
          subscription={subscription}
          isLegacy={false}
        />
      </PanelBody>
    );
  };

  renderFooter = () => {
    const {stepNumber, onCompleteStep} = this.props;

    return (
      <StepFooter data-test-id={this.title}>
        <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
          {t('Continue')}
        </Button>
      </StepFooter>
    );
  };

  render() {
    const {isActive, stepNumber, isCompleted, onEdit} = this.props;

    return (
      <Panel data-test-id="step-add-data-volume">
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

export default SetBudgetAndReserves;

const BaseRow = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  align-items: center;
`;

const RowWithTag = styled(BaseRow)`
  padding: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
`;

const SectionHeader = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const Title = styled('label')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  align-items: center;
  margin-bottom: 0px;
  font-weight: 600;
`;

const LargeTitle = styled(Title)`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const OptionalText = styled('span')`
  color: ${p => p.theme.subText};
  font-weight: 400;
`;

// footer
const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  align-items: center;
  justify-content: end;
`;
