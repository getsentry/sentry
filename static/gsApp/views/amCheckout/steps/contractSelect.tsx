import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {InvoiceItemType, Plan} from 'getsentry/types';
import PlanSelectRow from 'getsentry/views/amCheckout/components/planSelectRow';
import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import {formatPrice, getReservedPriceCents} from 'getsentry/views/amCheckout/utils';

const isAnnual = (plan: Plan) => {
  return plan.billingInterval === ANNUAL;
};

const getOptionName = (isAnnualPlan: boolean) => {
  return isAnnualPlan ? t('Annual Contract') : t('Monthly');
};

const getPriceHeader = (isAnnualPlan: boolean) => {
  return tct('Per [billingInterval]', {
    billingInterval: isAnnualPlan ? 'year' : 'month',
  });
};

function ContractSelect({
  formData,
  subscription,
  promotion,
  billingConfig,
  stepNumber,
  isActive,
  isCompleted,
  onUpdate,
  onEdit,
  onCompleteStep,
}: StepProps) {
  const title = t('Contract Term & Discounts');

  /**
   * Filter for monthly and annual billing intervals
   * of the same base plan. AM1 plans can either be
   * monthly or annual-up-front.
   */
  const getPlanOptions = () => {
    const basePlan = formData.plan.replace('_auf', '');
    const plans = billingConfig.planList.filter(({id}) => id.indexOf(basePlan) === 0);

    if (!plans) {
      throw new Error('Cannot get billing interval options');
    }
    return plans;
  };

  const annualContractWarning = (
    <ContractAlert type="info">
      {t(
        'You are currently on an annual contract so any subscription downgrades will take effect at the end of your contract period.'
      )}
    </ContractAlert>
  );

  const getDescription = (isAnnualPlan: boolean) => {
    return isAnnualPlan
      ? tct('Save an additional [annualDiscount]% by committing to a 12-month plan', {
          annualDiscount: billingConfig.annualDiscount * 100,
        })
      : t('Month-to-month contract');
  };

  const renderBody = () => {
    return (
      <PanelBody data-test-id={title}>
        {getPlanOptions().map(plan => {
          const isSelected = plan.id === formData.plan;

          const isAnnualPlan = isAnnual(plan);
          const name = getOptionName(isAnnualPlan);
          const description = getDescription(isAnnualPlan);
          const priceHeader = getPriceHeader(isAnnualPlan);

          const hasWarning =
            isSelected &&
            plan.contractInterval === MONTHLY &&
            subscription.contractInterval === ANNUAL &&
            subscription.partner?.partnership.id !== 'FL';

          const discountData: {
            amount?: number;
            creditCategory?: InvoiceItemType;
            discountType?: string;
          } = {
            // default to subscription discount
            // since we need a credit category to calculate the price after discount
            creditCategory: 'subscription',
          };
          if (
            promotion?.showDiscountInfo &&
            promotion.discountInfo &&
            // contract interval needs to match the discount interval
            promotion.discountInfo.billingInterval === plan.contractInterval
          ) {
            discountData.discountType = promotion.discountInfo.discountType;
            discountData.amount = promotion.discountInfo.amount;
          }

          const priceAfterDiscount = getReservedPriceCents({
            plan,
            reserved: formData.reserved,
            addOns: formData.addOns,
            ...discountData,
          });
          const formattedPriceAfterDiscount = formatPrice({cents: priceAfterDiscount});
          return (
            <PlanSelectRow
              key={plan.id}
              plan={plan}
              isSelected={isSelected}
              onUpdate={onUpdate}
              planName={name}
              planValue={plan.billingInterval}
              planContent={{description, features: {}}}
              priceHeader={priceHeader}
              planWarning={hasWarning ? annualContractWarning : undefined}
              shouldShowDefaultPayAsYouGo={false}
              shouldShowEventPrice={false}
              price={formattedPriceAfterDiscount}
            />
          );
        })}
      </PanelBody>
    );
  };

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
      {isActive && (
        <StepFooter data-test-id={title}>
          <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
            {t('Continue')}
          </Button>
        </StepFooter>
      )}
    </Panel>
  );
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
