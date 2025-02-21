import {Component} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {Plan} from 'getsentry/types';
import PlanSelectRow from 'getsentry/views/amCheckout/steps/planSelectRow';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import {getReservedTotal} from 'getsentry/views/amCheckout/utils';

type Props = StepProps;

class ContractSelect extends Component<Props> {
  get title() {
    return t('Contract Term & Discounts');
  }

  /**
   * Filter for monthly and annual billing intervals
   * of the same base plan. AM1 plans can either be
   * monthly or annual-up-front.
   */
  get planOptions() {
    const {billingConfig, formData} = this.props;
    const basePlan = formData.plan.replace('_auf', '');
    const plans = billingConfig.planList.filter(({id}) => id.indexOf(basePlan) === 0);

    if (!plans) {
      throw new Error('Cannot get billing interval options');
    }
    return plans;
  }

  get annualContractWarning() {
    return (
      <ContractAlert type="info">
        {t(
          'You are currently on an annual contract so any subscription downgrades will take effect at the end of your contract period.'
        )}
      </ContractAlert>
    );
  }

  isAnnual(plan: Plan) {
    return plan.billingInterval === ANNUAL;
  }

  getOptionName(isAnnual: boolean) {
    return isAnnual ? t('Annual Contract') : t('Monthly');
  }

  getDescription(isAnnual: boolean) {
    const {billingConfig} = this.props;

    return isAnnual
      ? tct('Save an additional [annualDiscount]% by committing to a 12-month plan', {
          annualDiscount: billingConfig.annualDiscount * 100,
        })
      : t('Month-to-month contract');
  }

  getPriceHeader(isAnnual: boolean) {
    return tct('Per [billingInterval]', {
      billingInterval: isAnnual ? 'year' : 'month',
    });
  }

  renderBody = () => {
    const {onUpdate, formData, subscription, promotion} = this.props;

    return (
      <PanelBody data-test-id={this.title}>
        {this.planOptions.map(plan => {
          const isSelected = plan.id === formData.plan;

          const isAnnual = this.isAnnual(plan);
          const name = this.getOptionName(isAnnual);
          const description = this.getDescription(isAnnual);
          const priceHeader = this.getPriceHeader(isAnnual);

          const hasWarning =
            isSelected &&
            plan.contractInterval === MONTHLY &&
            subscription.contractInterval === ANNUAL &&
            subscription.partner?.partnership.id !== 'FL';

          const discountData: {
            amount?: number;
            discountType?: string;
          } = {};
          if (
            promotion?.showDiscountInfo &&
            promotion.discountInfo &&
            // contract intervial needs to match the discount interval
            promotion.discountInfo.billingInterval === plan.contractInterval
          ) {
            discountData.discountType = promotion.discountInfo.discountType;
            discountData.amount = promotion.discountInfo.amount;
          }

          const price = getReservedTotal({
            plan,
            reserved: formData.reserved,
            ...discountData,
          });

          return (
            <PlanSelectRow
              key={plan.id}
              plan={plan}
              isSelected={isSelected}
              onUpdate={onUpdate}
              planValue={plan.billingInterval}
              planName={name}
              planContent={{description, features: {}}}
              priceHeader={priceHeader}
              price={price}
              planWarning={hasWarning ? this.annualContractWarning : undefined}
            />
          );
        })}
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

const ContractAlert = styled(Alert)`
  margin: ${space(2)} 0 0;
`;

const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  align-items: center;
  justify-content: end;
`;

export default ContractSelect;
