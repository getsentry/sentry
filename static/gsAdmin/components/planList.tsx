import styled from '@emotion/styled';

import CheckboxField from 'sentry/components/forms/fields/checkboxField';
import InputField from 'sentry/components/forms/fields/inputField';
import RadioField from 'sentry/components/forms/fields/radioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import type FormModel from 'sentry/components/forms/model';
import type {Data, OnSubmitCallback} from 'sentry/components/forms/types';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {ANNUAL} from 'getsentry/constants';
import type {BillingConfig, Plan, Subscription} from 'getsentry/types';
import {getPlanCategoryName, isByteCategory} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';

type Props = {
  activePlan: Plan | null;
  formModel: FormModel;
  onCancel: () => void;
  onPlanChange: (plan: Plan) => void;
  onSubmit: OnSubmitCallback;
  onSubmitError: (error: any) => void;
  onSubmitSuccess: (data: Data) => void;
  organization: Organization;
  subscription: Subscription;
  tierPlans: BillingConfig['planList'];
};

function PlanList({
  activePlan,
  subscription,
  organization,
  onSubmit,
  onCancel,
  onSubmitSuccess,
  onSubmitError,
  formModel,
  tierPlans,
  onPlanChange,
}: Props) {
  /**
   * Helper to get current value display for a category
   */
  const getCurrentValueDisplay = (category: DataCategory) => {
    // Check if categories exist
    if (subscription.categories) {
      // Get the category data using type assertion to allow string indexing
      const categories = subscription.categories as Record<string, {reserved?: number}>;

      if (categories[category]?.reserved !== undefined) {
        const reservedValue = categories[category].reserved;

        return (
          <CurrentValueText>
            Current: {reservedValue.toLocaleString()}{' '}
            {isByteCategory(category) ? 'GB' : ''}
          </CurrentValueText>
        );
      }
    }

    return <CurrentValueText>Current: None</CurrentValueText>;
  };

  // for legacy errors-only plans
  const formattedReservedMinimum = {
    6000000: '6M',
    5000000: '5M',
    4000000: '4M',
    3000000: '3M',
    1500000: '1.5M',
    500000: '500k',
    100000: '100K',
  };

  const availableProducts = Object.values(activePlan?.availableReservedBudgetTypes || {})
    .filter(
      productInfo =>
        productInfo.isFixed && // NOTE: for now, we only supported fixed budget products in checkout
        productInfo.billingFlag &&
        organization.features.includes(productInfo.billingFlag)
    )
    .map(productInfo => {
      return productInfo;
    });

  return (
    <Form
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitLabel="Change Plan"
      submitPriority="danger"
      model={formModel}
      onSubmitSuccess={onSubmitSuccess}
      onSubmitError={onSubmitError}
    >
      <StyledFormSection>
        <RadioField
          name="plan"
          required
          choices={tierPlans.map(plan => [
            plan.id,
            <PlanLabel key={plan.id} data-test-id={`change-plan-label-${plan.id}`}>
              <div>
                <strong>
                  {plan.name}{' '}
                  {formattedReservedMinimum[
                    plan.reservedMinimum as keyof typeof formattedReservedMinimum
                  ] ?? ''}
                </strong>{' '}
                <SubText>— {plan.id}</SubText>
                <br />
                <small>
                  {formatCurrency(plan.price)} /{' '}
                  {plan.billingInterval === ANNUAL ? 'annually' : 'monthly'}
                </small>
              </div>
            </PlanLabel>,
          ])}
          onChange={value => {
            const plan = tierPlans.find(p => p.id === value);
            if (plan) {
              onPlanChange(plan);
            }
          }}
          value={activePlan?.id ?? null}
        />
      </StyledFormSection>
      {activePlan &&
        (
          activePlan?.planCategories.transactions ||
          activePlan?.planCategories.spans ||
          []
        ).length > 1 && (
          <StyledFormSection>
            <h4>Reserved Volumes</h4>
            {activePlan.checkoutCategories.map(category => {
              const titleCategory = getPlanCategoryName({
                plan: activePlan,
                category,
              });
              const reservedKey = `reserved${toTitleCase(category, {
                allowInnerUpperCase: true,
              })}`;
              const label = isByteCategory(category)
                ? `${titleCategory} (GB)`
                : titleCategory;
              const fieldValue = formModel.getValue(reservedKey);
              const currentValueDisplay = getCurrentValueDisplay(category);
              return (
                <SelectFieldWrapper key={`test-${category}`}>
                  <SelectField
                    inline={false}
                    stacked
                    name={reservedKey}
                    label={label}
                    value={fieldValue}
                    options={(activePlan.planCategories[category] || []).map(
                      (level: {events: {toLocaleString: () => any}}) => ({
                        // eslint-disable-next-line @typescript-eslint/no-base-to-string
                        label: level.events.toLocaleString(),
                        value: level.events,
                      })
                    )}
                    required
                  />
                  {currentValueDisplay}
                </SelectFieldWrapper>
              );
            })}
          </StyledFormSection>
        )}
      {availableProducts.length > 0 && (
        <StyledFormSection>
          <h4>Available Products</h4>
          {availableProducts.map(productInfo => {
            return (
              <CheckboxField
                key={productInfo.productName}
                data-test-id={`checkbox-${productInfo.productName}`}
                label={toTitleCase(productInfo.productName)}
                name={productInfo.productName}
                onChange={(value: any) => {
                  formModel.setValue(productInfo.productName, value.target.checked);
                }}
              />
            );
          })}
        </StyledFormSection>
      )}
      <AuditFields>
        <InputField
          data-test-id="url-field"
          name="ticket-url"
          type="url"
          label="TicketUrl"
          inline={false}
          stacked
          flexibleControlStateSize
        />
        <TextField
          data-test-id="notes-field"
          name="notes"
          label="Notes"
          inline={false}
          stacked
          flexibleControlStateSize
          maxLength={500}
        />
      </AuditFields>
    </Form>
  );
}

const StyledFormSection = styled('div')`
  margin: ${space(1)} 0;

  & > h4 {
    margin: ${space(2)} 0;
  }
`;

const PlanLabel = styled('label')`
  margin-bottom: 0;

  display: flex;
  align-items: flex-start;

  & > div {
    margin-right: ${space(3)};
  }
`;

const SubText = styled('small')`
  font-weight: normal;
  color: #999;
`;

const SelectFieldWrapper = styled('div')`
  position: relative;
`;

const CurrentValueText = styled('div')`
  color: #666;
  font-size: 0.9em;
  margin-top: -${space(1)};
  margin-bottom: ${space(1.5)};
  font-style: italic;
`;

const AuditFields = styled('div')`
  margin-top: ${space(2)};
`;

export default PlanList;
