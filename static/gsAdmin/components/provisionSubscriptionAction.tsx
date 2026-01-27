import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import upperFirst from 'lodash/upperFirst';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import BooleanField from 'sentry/components/deprecatedforms/booleanField';
import {DateTimeField} from 'sentry/components/deprecatedforms/dateTimeField';
import Form from 'sentry/components/deprecatedforms/form';
import InputField from 'sentry/components/deprecatedforms/inputField';
import NumberField, {
  NumberField as NumberFieldNoContext,
} from 'sentry/components/deprecatedforms/numberField';
import SelectField from 'sentry/components/deprecatedforms/selectField';
import withFormContext from 'sentry/components/deprecatedforms/withFormContext';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {space} from 'sentry/styles/space';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import withApi from 'sentry/utils/withApi';

import {prettyDate} from 'admin/utils';
import {CPE_MULTIPLIER_TO_CENTS, RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {
  ReservedBudgetCategoryType,
  type BillingConfig,
  type Plan,
  type ReservedBudgetMetricHistory,
  type Subscription,
} from 'getsentry/types';
import {
  displayBudgetName,
  getAmPlanTier,
  isAm3DsPlan,
  isAm3Plan,
  isAmEnterprisePlan,
  isAmPlan,
  isTrialPlan,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  isByteCategory,
} from 'getsentry/utils/dataCategory';

const CPE_DECIMAL_PRECISION = 8;

// TODO: replace with modern fields so we don't need these workarounds
class DateFieldNoContext extends DateTimeField {
  getType() {
    return 'date';
  }
}

const DateField = withFormContext(DateFieldNoContext);

type DollarsAndCentsFieldProps = {
  max?: number;
  min?: number;
  step?: any;
} & NumberFieldNoContext['props'];

class DollarsFieldNoContext extends NumberFieldNoContext {
  getField() {
    return (
      <div className="dollars-field-container">
        <span className="dollar-sign">$</span>
        {super.getField()}
      </div>
    );
  }
}

const DollarsField = withFormContext(DollarsFieldNoContext);

class DollarsAndCentsFieldNoContext extends InputField<DollarsAndCentsFieldProps> {
  getField() {
    return (
      <div className="dollars-cents-field-container">
        <span className="dollar-sign">$</span>
        {super.getField()}
      </div>
    );
  }
  coerceValue(value: any): number | '' {
    const floatValue = parseFloat(value);
    if (isNaN(floatValue)) {
      return '';
    }
    return floatValue;
  }

  getType() {
    return 'number';
  }

  getAttributes() {
    return {
      min: this.props.min || undefined,
      max: this.props.max || undefined,
      step: this.props.step || undefined,
    };
  }
}

const DollarsAndCentsField = withFormContext(DollarsAndCentsFieldNoContext);

type Props = {
  api: Client;
  billingConfig: BillingConfig | null;
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
  organization?: Organization;
};

type ModalProps = ModalRenderProps & Props;

type ModalState = {
  data: any;
  // TODO(ts)
  effectiveAtDisabled: boolean;
  isLoading: boolean;
  provisionablePlans: Record<string, Plan>;
};

/**
 * Convert cents to dollars
 * @param cents - cents to convert
 * @returns dollars
 */
function toDollars(cents: number | null | undefined, decimals = 0) {
  if (typeof cents !== 'number') {
    return cents;
  }
  return parseFloat((cents / 100).toFixed(decimals));
}

/**
 * Convert cents to annual dollars
 * @param cents - cents to convert
 * @param billingInterval - billing interval
 * @returns annual dollars
 */
function toAnnualDollars(
  cents: number | null | undefined,
  billingInterval: string | null | undefined,
  decimals = 0
) {
  if (typeof cents !== 'number') {
    return cents;
  }
  if (billingInterval === 'monthly') {
    return toDollars(cents * 12, decimals);
  }
  return toDollars(cents, decimals);
}

/**
 * Convert dollars to 0.000001 cents
 * @param dollars - dollars to convert
 * @returns dollars in units of 0.000001 cents
 */
function toCpeCents(dollars: number | null | undefined) {
  if (typeof dollars !== 'number') {
    return dollars;
  }
  return parseInt(((dollars * 100) / CPE_MULTIPLIER_TO_CENTS).toFixed(0), 10);
}

function toCents(dollars: number | null | undefined, decimals = 0) {
  if (typeof dollars !== 'number') {
    return dollars;
  }
  return parseFloat((dollars * 100).toFixed(decimals));
}

class ProvisionSubscriptionModal extends Component<ModalProps, ModalState> {
  state: ModalState = {
    isLoading: true,
    data: {},
    effectiveAtDisabled: false,
    provisionablePlans: {},
  };

  componentDidMount() {
    this.initializeState();
    this.setState({isLoading: false});
  }

  initializeState() {
    const {subscription, billingConfig} = this.props;

    const provisionablePlans = billingConfig
      ? billingConfig.planList.reduce(
          (acc, plan) => {
            if (
              (isAmEnterprisePlan(plan.id) ||
                plan.id === 'e1' ||
                plan.id === 'mm2_a' ||
                plan.id === 'mm2_b') &&
              !plan.id.endsWith('_ac') &&
              !plan.id.endsWith('_auf') &&
              !isTrialPlan(plan.id) &&
              !plan.isTestPlan
            ) {
              acc[plan.id] = plan;
            }
            return acc;
          },
          {} as Record<string, Plan>
        )
      : {};

    this.setState(state => ({
      ...state,
      provisionablePlans,
    }));

    const existingPlanWithoutSuffix = subscription.plan.endsWith('_auf')
      ? subscription.plan.slice(0, -4)
      : subscription.plan.endsWith('_ac')
        ? subscription.plan.slice(0, -3)
        : subscription.plan;
    const existingPlanIsEnterprise = Object.keys(provisionablePlans).includes(
      existingPlanWithoutSuffix
    );

    const reservedBudgets = subscription.reservedBudgets;
    const reservedBudgetMetricHistories: Record<string, ReservedBudgetMetricHistory> = {};
    reservedBudgets?.forEach(budget => {
      Object.entries(budget.categories).forEach(([category, info]) => {
        reservedBudgetMetricHistories[category] = info;
      });
    });
    const seerBudget = reservedBudgets?.find(
      budget => budget.apiName === ReservedBudgetCategoryType.SEER
    )?.reservedBudget;
    const dynamicSamplingBudget = reservedBudgets?.find(
      budget => budget.apiName === ReservedBudgetCategoryType.DYNAMIC_SAMPLING
    )?.reservedBudget;

    const infoFromMetricHistories: Record<string, any> = {};
    Object.entries(subscription.categories).forEach(([category, info]) => {
      const categorySuffix = this.capitalizeForApiName(category);
      infoFromMetricHistories[`reserved${categorySuffix}`] = info.reserved;
      if (existingPlanIsEnterprise) {
        infoFromMetricHistories[`softCapType${categorySuffix}`] = info.softCapType;
        infoFromMetricHistories[`customPrice${categorySuffix}`] = toAnnualDollars(
          info.customPrice,
          subscription.billingInterval
        );
        infoFromMetricHistories[`paygCpe${categorySuffix}`] = toDollars(
          info.paygCpe,
          CPE_DECIMAL_PRECISION
        );
        infoFromMetricHistories[`reservedCpe${categorySuffix}`] = toDollars(
          reservedBudgetMetricHistories[category]?.reservedCpe,
          CPE_DECIMAL_PRECISION
        );
      }
    });
    const enterpriseData = existingPlanIsEnterprise
      ? {
          plan: existingPlanWithoutSuffix,
          billingInterval: subscription.billingInterval,
          retainOnDemandBudget: false,
          type: subscription.type,
          onDemandInvoicedManual: subscription.onDemandInvoicedManual
            ? subscription.onDemandBudgets?.budgetMode.toString().toUpperCase()
            : subscription.onDemandInvoicedManual === null
              ? null
              : 'DISABLE',
          managed: subscription.isManaged,
          customPricePcss: toAnnualDollars(
            subscription.customPricePcss,
            subscription.billingInterval
          ),
          customPrice: toAnnualDollars(
            subscription.customPrice,
            subscription.billingInterval
          ),
        }
      : {};
    this.setState(state => ({
      ...state,
      data: {
        ...state.data,
        ...enterpriseData,
        ...infoFromMetricHistories,
        seerBudget: toDollars(seerBudget ?? 0),
        dynamicSamplingBudget: toDollars(dynamicSamplingBudget ?? 0),
      },
    }));
  }

  capitalizeForApiName = (categoryString: string) => {
    return upperFirst(categoryString);
  };

  get endpoint() {
    return `/customers/${this.props.orgId}/provision-subscription/`;
  }

  isEnablingOnDemandMaxSpend = () =>
    this.state.data.onDemandInvoicedManual === 'SHARED' ||
    this.state.data.onDemandInvoicedManual === 'PER_CATEGORY';

  isEnablingSoftCap = () =>
    Object.entries(this.state.data)
      .filter(([key, _]) => key.startsWith('softCapType'))
      .some(([_, value]) => value !== null);

  isReservedBudgetCategory = (isAm3Ds: boolean, category: DataCategory): boolean => {
    const seerCategories = [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER];
    const spansCategories = [DataCategory.SPANS, DataCategory.SPANS_INDEXED];

    return (
      seerCategories.includes(category) || (isAm3Ds && spansCategories.includes(category))
    );
  };

  /**
   * If the user has set reserved CPEs for both span categories, assume we're setting the spans budget
   * NOTE: this and probably the way we let users set reserved budgets in this form will need to
   * change if we ever allowed reserved budgets for other subsets of categories
   */
  isSettingSpansBudget = () =>
    isAm3DsPlan(this.state.data.plan) &&
    Object.entries(this.state.data)
      .filter(([key, _]) => key.startsWith('reservedCpeSpans'))
      .every(([_, value]) => value !== null || value !== undefined) &&
    Object.keys(this.state.data).filter(key => key.startsWith('reservedCpeSpans'))
      .length >= 2;

  // Same as above, but for Seer budgets
  isSettingSeerBudget = () =>
    Object.entries(this.state.data)
      .filter(([key, _]) => key.startsWith('reservedCpeSeer'))
      .every(([_, value]) => value !== null && value !== undefined) &&
    Object.keys(this.state.data).filter(key => key.startsWith('reservedCpeSeer'))
      .length >= 2;

  isSettingReservedBudget = (category: DataCategory) => {
    if (category === DataCategory.SPANS || category === DataCategory.SPANS_INDEXED) {
      return this.isSettingSpansBudget();
    }
    if (
      category === DataCategory.SEER_AUTOFIX ||
      category === DataCategory.SEER_SCANNER
    ) {
      return this.isSettingSeerBudget();
    }
    return false;
  };

  /**
   * Whether the user has set all the required fields to provision a spans budget.
   * These include the reserved CPEs and reserved volumes for each span category,
   * as well as a custom price for spans which serves as the budget amount.
   */
  hasCompleteSpansBudget = () =>
    this.isSettingSpansBudget() &&
    Object.entries(this.state.data)
      .filter(([key, _]) => key.startsWith('reservedSpans'))
      .every(([_, value]) => value === RESERVED_BUDGET_QUOTA) &&
    this.state.data.dynamicSamplingBudget;

  // Same as above, but for Seer budgets
  hasCompleteSeerBudget = () =>
    this.isSettingSeerBudget() &&
    Object.entries(this.state.data)
      .filter(([key, _]) => key.startsWith('reservedSeer') && key !== 'reservedSeerUsers')
      .every(([_, value]) => value === RESERVED_BUDGET_QUOTA) &&
    this.state.data.seerBudget;

  /**
   * If the user is changing the PAYG max spend mode or disabling it,
   * don't retain the customer's existing PAYG max spend settings.
   */
  disableRetainOnDemand = () => {
    if (this.state.data.onDemandInvoicedManual === null) {
      // don't show the toggle if there is no ondemand type
      return true;
    }
    const original = this.props.subscription.onDemandInvoicedManual
      ? this.props.subscription.onDemandBudgets?.budgetMode.toString().toUpperCase()
      : this.props.subscription.onDemandInvoicedManual === null
        ? null
        : 'DISABLE';
    return (
      this.state.data.onDemandInvoicedManual !== original ||
      this.state.data.onDemandInvoicedManual === 'DISABLE'
    );
  };

  onSubmit: Form['props']['onSubmit'] = (formData, _onSubmitSuccess, onSubmitError) => {
    const postData: Record<string, any> = {...this.state.data};

    for (const k in formData) {
      if (formData[k] !== '' && formData[k] !== null) {
        postData[k] = formData[k];
      }
    }

    // clear conflicting fields regarding when the changes take effect
    if (postData.atPeriodEnd || postData.coterm) {
      delete postData.effectiveAt;
    }
    if (!postData.coterm) {
      delete postData.coterm;
    }

    // remove custom price fields if the plan is not AM Enterprise
    const hasCustomSkuPrices = isAmEnterprisePlan(postData.plan);
    if (!hasCustomSkuPrices) {
      const customSkuFields = Object.keys(postData).filter(
        key => key.startsWith('customPrice') && key !== 'customPrice'
      );
      customSkuFields.forEach(key => {
        delete postData[key];
      });
    }

    const allCategories = Object.values(DATA_CATEGORY_INFO).map(
      c => c.plural as DataCategory
    );
    const planCategories = allCategories.filter(c =>
      this.state.provisionablePlans[postData.plan]?.categories.includes(c)
    );

    // remove fields for any categories that are not in the selected plan
    allCategories.forEach(category => {
      if (!planCategories.includes(category)) {
        const categorySuffix = this.capitalizeForApiName(category);
        delete postData[`reserved${categorySuffix}`];
        delete postData[`customPrice${categorySuffix}`];
        delete postData[`softCapType${categorySuffix}`];
        delete postData[`paygCpe${categorySuffix}`];
        delete postData[`reservedCpe${categorySuffix}`];
      }
    });

    // remove PAYG fields if the plan is not invoiced
    if (postData.type !== 'invoiced') {
      delete postData.onDemandInvoicedManual;
      const paygCpeFields = Object.keys(postData).filter(key =>
        key.startsWith('paygCpe')
      );
      paygCpeFields.forEach(key => {
        delete postData[key];
      });

      // clear corresponding state
      this.setState(state => ({
        ...state,
        data: {
          ...state.data,
          onDemandInvoicedManual: null,
        },
      }));
    }

    // soft cap and PAYG max spend are mutually exclusive
    if (this.isEnablingOnDemandMaxSpend()) {
      Object.keys(postData).forEach(key => {
        if (key.startsWith('softCapType')) {
          postData[key] = null;
          this.setState(state => ({
            ...state,
            data: {
              ...state.data,
              [key]: null,
            },
          }));
        }
      });
    } else {
      const paygCpeFields = Object.keys(postData).filter(key =>
        key.startsWith('paygCpe')
      );
      paygCpeFields.forEach(key => {
        delete postData[key];
      });
    }
    if (this.isEnablingSoftCap()) {
      postData.onDemandInvoicedManual = 'DISABLE';
      const paygCpeFields = Object.keys(postData).filter(key =>
        key.startsWith('paygCpe')
      );
      paygCpeFields.forEach(key => {
        delete postData[key];
      });
    }

    // convert any currency fields to the right unit
    Object.entries(postData).forEach(([key, value]) => {
      if (
        (key.startsWith('paygCpe') || key.startsWith('reservedCpe')) &&
        !isNaN(value as number)
      ) {
        postData[key] = toCpeCents(value as number); // price should be in 0.000001 cents
      } else if (
        (key.startsWith('customPrice') ||
          key === 'seerBudget' ||
          key === 'dynamicSamplingBudget') &&
        !isNaN(value as number)
      ) {
        postData[key] = toCents(value as number); // price should be in cents
      }
    });

    if (postData.customPrice) {
      // For AM only: If customPrice is set, ensure that it is equal to sum of SKU prices
      const skuSum = Object.entries(postData).reduce((acc, [key, value]) => {
        if (
          key.startsWith('customPrice') &&
          typeof value === 'number' &&
          key !== 'customPrice'
        ) {
          return acc + (value ?? 0);
        }
        return acc;
      }, 0);

      if (hasCustomSkuPrices && postData.customPrice !== skuSum) {
        onSubmitError({
          responseJSON: {
            customPrice: ['Custom Price must be equal to sum of SKU prices'],
          },
        });
        return;
      }
    }

    // override retainOnDemandBudget based on whether user is changing the mode or disabling PAYG, or not
    postData.retainOnDemandBudget = postData.retainOnDemandBudget
      ? !this.disableRetainOnDemand()
      : false;

    if (isAmPlan(postData.plan)) {
      // Setting soft cap types to null if not `ON_DEMAND` or `TRUE_FORWARD` ensures soft cap type
      // is disabled if it was set but is not set with the new provisioning request.
      planCategories.forEach(category => {
        const key = `softCapType${this.capitalizeForApiName(category)}`;
        if (postData[key] !== 'ON_DEMAND' && postData[key] !== 'TRUE_FORWARD') {
          postData[key] = null;
        }
      });

      // Update trueForward object to reflect the new soft cap types
      postData.trueForward = {
        ...planCategories.reduce((acc, category) => {
          return {
            ...acc,
            [category]:
              (postData[`softCapType${this.capitalizeForApiName(category)}`] ?? null) ===
              'TRUE_FORWARD',
          };
        }, {}),
      };
    }

    postData.reservedBudgets = [];
    if (isAm3DsPlan(postData.plan)) {
      // Validate DS plan and reserved spans budget
      if (this.hasCompleteSpansBudget()) {
        postData.reservedBudgets.push({
          categories: [
            DATA_CATEGORY_INFO[DataCategoryExact.SPAN].plural,
            DATA_CATEGORY_INFO[DataCategoryExact.SPAN_INDEXED].plural,
          ],
          budget: postData.dynamicSamplingBudget,
        });
      } else {
        onSubmitError({
          responseJSON: {
            customPriceSpans: [
              'Dynamic Sampling plans require reserved spans budget with reserved CPEs for both accepted and stored spans',
            ],
          },
        });
        return;
      }
    }
    delete postData.dynamicSamplingBudget;

    if (this.hasCompleteSeerBudget()) {
      postData.reservedBudgets.push({
        categories: [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER],
        budget: postData.seerBudget,
      });
    } else {
      delete postData.reservedCpeSeerAutofix;
      delete postData.reservedCpeSeerScanner;
    }
    delete postData.seerBudget;

    this.props.api.request(this.endpoint, {
      method: 'POST',
      data: postData,
      success: () => {
        this.props.onSuccess();
        this.props.closeModal();
      },
      error: error => {
        onSubmitError({
          responseJSON: error.responseJSON,
        });
      },
    });
  };

  render() {
    const {Header, Body, closeModal, organization} = this.props;
    const {data} = this.state;

    const isAmEnt = isAmEnterprisePlan(data.plan);
    const isAm3Ds = isAm3DsPlan(data.plan);
    const hasCustomSkuPrices = isAmEnt;
    const hasCustomPrice = hasCustomSkuPrices || !!data.managed; // Refers to ACV
    const selectedPlan = this.state.provisionablePlans[data.plan];

    const isNewSeer = organization ? showNewSeer(organization) : false;
    const hiddenCategories = isNewSeer
      ? [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER]
      : [DataCategory.SEER_USER];

    if (this.state.isLoading) {
      return <LoadingIndicator />;
    }

    return (
      <Fragment>
        <Header>Provision Subscription Changes</Header>
        <Body>
          <Form
            onSubmit={this.onSubmit}
            onCancel={closeModal}
            submitLabel="Submit"
            cancelLabel="Cancel"
            footerClass="modal-footer"
          >
            <Columns>
              <div>
                <SelectField
                  label="Plan"
                  name="plan"
                  clearable={false}
                  choices={Object.entries(this.state.provisionablePlans)
                    .reverse()
                    .map(([id, plan]) => {
                      const suffix = isAm3DsPlan(plan.id) ? ' with Dynamic Sampling' : '';

                      return [
                        id,
                        `${plan.name}${suffix} (${isAmPlan(plan.id) ? getAmPlanTier(plan.id) : plan.id === 'e1' ? 'mm1' : 'mm2'})`,
                      ];
                    })}
                  onChange={v => {
                    // Reset price fields if next plan is not AM Enterprise
                    const isManagedPlan = isAmEnterprisePlan(v as string);
                    const chosenPlanIsAm3Ds = isAm3DsPlan(v as string);
                    const nextPrices = isManagedPlan
                      ? {}
                      : Object.keys(this.state.data)
                          .filter(key => key.startsWith('customPrice'))
                          .reduce((acc, key) => {
                            return {...acc, [key]: ''};
                          }, {});
                    const nextReservedCpes = chosenPlanIsAm3Ds
                      ? {}
                      : Object.keys(this.state.data)
                          .filter(key => key.startsWith('reservedCpe'))
                          .reduce((acc, key) => {
                            return {...acc, [key]: null};
                          }, {});
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        plan: v,
                        ...nextPrices,
                        ...nextReservedCpes,
                      },
                    }));
                  }}
                  value={this.state.data.plan}
                />
                <BooleanField
                  label={`Apply Changes at the End of the Current Billing Period (${prettyDate(
                    this.props.subscription.contractPeriodEnd
                  )})`}
                  name="atPeriodEnd"
                  disabled={this.state.data.coterm}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      effectiveAtDisabled: !!v,
                      data: {...state.data, atPeriodEnd: v},
                    }))
                  }
                />
                <BooleanField
                  label="Apply Changes To Current Subscription"
                  name="coterm"
                  disabled={this.state.data.atPeriodEnd}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, coterm: v},
                      effectiveAtDisabled: !!v,
                    }))
                  }
                />
                <DateField
                  label="Start Date"
                  name="effectiveAt"
                  help="The date at which this change should take effect."
                  disabled={this.state.effectiveAtDisabled}
                  required={!this.state.effectiveAtDisabled}
                />
                <SelectField
                  label="Billing Interval"
                  name="billingInterval"
                  choices={[
                    ['annual', 'Annual'],
                    ['monthly', 'Monthly'],
                  ]}
                  disabled={!this.state.data.plan}
                  required={!!this.state.data.plan}
                  value={this.state.data.billingInterval}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...this.state.data,
                        billingInterval: v,
                      },
                    }))
                  }
                />
                <BooleanField
                  label="Managed Subscription"
                  name="managed"
                  value={hasCustomSkuPrices || this.state.data.managed}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        managed: v,
                        customPrice: v ? state.data.customPrice : '',
                      },
                    }))
                  }
                />

                <SelectField
                  label="Billing Type"
                  name="type"
                  choices={[
                    ['invoiced', 'Invoiced'],
                    ['credit_card', 'Credit Card'],
                  ]}
                  onChange={v => {
                    if (v === 'credit_card') {
                      this.setState(state => ({
                        ...state,
                        data: {...state.data, onDemandInvoicedManual: ''},
                      }));
                    }
                    this.setState(state => ({...state, data: {...state.data, type: v}}));
                  }}
                  value={this.state.data.type}
                />
                {this.state.data.type === 'invoiced' && (
                  <StyledSelectFieldWithHelpText
                    label={`${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Max Spend Setting`}
                    name="onDemandInvoicedManual"
                    choices={
                      isAm3Plan(this.state.data.plan)
                        ? [
                            ['SHARED', 'Shared'],
                            ['DISABLE', 'Disable'],
                          ]
                        : [
                            ['SHARED', 'Shared'],
                            ['PER_CATEGORY', 'Per Category'],
                            ['DISABLE', 'Disable'],
                          ]
                    }
                    help={`Used to enable (Shared or Per Category) or disable ${selectedPlan ? displayBudgetName(selectedPlan) : 'pay-as-you-go'} max spend for invoiced customers. Cannot be provisioned with soft cap.`}
                    clearable
                    disabled={
                      this.state.data.type === 'credit_card' || this.isEnablingSoftCap()
                    }
                    value={this.state.data.onDemandInvoicedManual}
                    onChange={v => {
                      this.setState(state => ({
                        ...state,
                        data: {...state.data, onDemandInvoicedManual: v ? v : null},
                      }));
                    }}
                  />
                )}

                {!this.disableRetainOnDemand() && (
                  <BooleanField
                    label={`Retain ${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Budget`}
                    name="retainOnDemandBudget"
                    value={this.state.data.retainOnDemandBudget}
                    help={`Check to retain the customer's current ${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Budget. Otherwise, the customer's ${selectedPlan ? displayBudgetName(selectedPlan) : 'Pay-as-you-go'} Budget will be set based on the default calculations (0.5 times the monthly plan price).`}
                    onChange={v =>
                      this.setState(state => ({
                        ...state,
                        data: {
                          ...state.data,
                          retainOnDemandBudget: v,
                        },
                      }))
                    }
                  />
                )}
                {selectedPlan && (selectedPlan?.categories.length ?? 0) > 0 && (
                  <Fragment>
                    <SectionHeader>Plan Quotas</SectionHeader>
                    <SectionHeaderDescription>
                      Monthly quantities for each SKU
                    </SectionHeaderDescription>
                    {selectedPlan?.categories.map(category => {
                      const categoryInfo = getCategoryInfoFromPlural(category);
                      if (!categoryInfo || hiddenCategories.includes(category)) {
                        return null;
                      }
                      const titleName = getPlanCategoryName({
                        plan: selectedPlan,
                        category,
                        title: true,
                        hadCustomDynamicSampling: isAm3Ds,
                      });
                      const suffix = isByteCategory(category) ? ' (in GB)' : '';
                      const capitalizedApiName = this.capitalizeForApiName(
                        categoryInfo.plural
                      );
                      return (
                        <Fragment key={categoryInfo.plural}>
                          <NumberField
                            label={`Reserved ${titleName}${suffix}`}
                            name={`reserved${capitalizedApiName}`}
                            required
                            disabled={this.state.data[`reservedCpe${capitalizedApiName}`]}
                            value={this.state.data[`reserved${capitalizedApiName}`]}
                            onChange={v =>
                              this.setState(state => ({
                                ...state,
                                data: {
                                  ...state.data,
                                  [`reserved${capitalizedApiName}`]: v,
                                },
                              }))
                            }
                          />
                          <SelectField
                            label={`Soft Cap Type ${titleName}`}
                            name={`softCapType${capitalizedApiName}`}
                            clearable
                            required={false}
                            choices={[
                              ['ON_DEMAND', 'On Demand'],
                              ['TRUE_FORWARD', 'True Forward'],
                            ]}
                            disabled={this.isEnablingOnDemandMaxSpend()}
                            value={this.state.data[`softCapType${capitalizedApiName}`]}
                            onChange={v =>
                              this.setState(state => ({
                                ...state,
                                data: {
                                  ...state.data,
                                  [`softCapType${capitalizedApiName}`]: v ? v : null,
                                },
                              }))
                            }
                          />
                          {this.isReservedBudgetCategory(isAm3Ds, category) && (
                            <StyledDollarsAndCentsField
                              label={`Reserved Cost-Per-Event ${titleName}`}
                              name={`reservedCpe${capitalizedApiName}`}
                              value={data[`reservedCpe${capitalizedApiName}`]}
                              step={0.00000001}
                              min={0}
                              max={1}
                              onChange={v => {
                                // Normalize and validate CPE value before updating state
                                const normalizedValue =
                                  typeof v === 'number'
                                    ? v
                                    : parseFloat(String(v || '').trim());

                                this.setState(state => {
                                  const updates: Record<string, any> = {
                                    [`reservedCpe${capitalizedApiName}`]: v,
                                  };

                                  if (
                                    Number.isFinite(normalizedValue) &&
                                    normalizedValue > 0
                                  ) {
                                    // Set reserved to RESERVED_BUDGET_QUOTA when CPE has a valid positive value
                                    // This indicates the category should use budget-based billing
                                    updates[`reserved${capitalizedApiName}`] =
                                      RESERVED_BUDGET_QUOTA;
                                  } else if (
                                    state.data[`reserved${capitalizedApiName}`] ===
                                    RESERVED_BUDGET_QUOTA
                                  ) {
                                    // Clear reserved field when CPE is invalid to maintain consistency
                                    // and allow manual reserved quantity input
                                    updates[`reserved${capitalizedApiName}`] = '';
                                  }
                                  // Otherwise, leave reserved unchanged

                                  return {
                                    ...state,
                                    data: {
                                      ...state.data,
                                      ...updates,
                                    },
                                  };
                                });
                              }}
                              onBlur={() => {
                                const currentValue = parseFloat(
                                  this.state.data[`reservedCpe${capitalizedApiName}`]
                                );
                                if (!isNaN(currentValue)) {
                                  this.setState(state => ({
                                    ...state,
                                    data: {
                                      ...state.data,
                                      [`reservedCpe${capitalizedApiName}`]:
                                        currentValue.toFixed(CPE_DECIMAL_PRECISION),
                                    },
                                  }));
                                }
                              }}
                            />
                          )}
                          {this.isEnablingOnDemandMaxSpend() && (
                            <StyledDollarsAndCentsField
                              label={`${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Cost-Per-Event ${titleName}`}
                              name={`paygCpe${capitalizedApiName}`}
                              value={data[`paygCpe${capitalizedApiName}`]}
                              step={0.00000001}
                              min={0.00000001}
                              max={1}
                              onChange={v =>
                                this.setState(state => ({
                                  ...state,
                                  data: {
                                    ...state.data,
                                    [`paygCpe${capitalizedApiName}`]: v,
                                  },
                                }))
                              }
                              required
                              onBlur={() => {
                                const currentValue = parseFloat(
                                  this.state.data[`paygCpe${capitalizedApiName}`]
                                );
                                if (!isNaN(currentValue)) {
                                  this.setState(state => ({
                                    ...state,
                                    data: {
                                      ...state.data,
                                      [`paygCpe${capitalizedApiName}`]:
                                        currentValue.toFixed(CPE_DECIMAL_PRECISION),
                                    },
                                  }));
                                }
                              }}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                    {!isNewSeer && this.isSettingSeerBudget() && (
                      <StyledDollarsField
                        label="Seer Budget"
                        name="seerBudget"
                        help="Monthly reserved budget for Seer"
                        required={this.isSettingSeerBudget()}
                        value={data.seerBudget}
                        onChange={v =>
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              seerBudget: v,
                            },
                          }))
                        }
                      />
                    )}
                    {isAm3DsPlan(selectedPlan.id) && (
                      <StyledDollarsField
                        label="Dynamic Sampling Budget"
                        name="dynamicSamplingBudget"
                        help="Monthly reserved budget for Dynamic Sampling"
                        required={this.isSettingSpansBudget()}
                        value={data.dynamicSamplingBudget}
                        onChange={v =>
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              dynamicSamplingBudget: v,
                            },
                          }))
                        }
                      />
                    )}
                  </Fragment>
                )}
              </div>
              <div>
                <SectionHeader>Reserved Volume Prices</SectionHeader>
                <SectionHeaderDescription>
                  Annual prices for reserved volumes, in whole dollars.
                </SectionHeaderDescription>
                {selectedPlan?.categories.map(category => {
                  const categoryInfo = getCategoryInfoFromPlural(category);
                  if (!categoryInfo || hiddenCategories.includes(category)) {
                    return null;
                  }
                  const titleName = getPlanCategoryName({
                    plan: selectedPlan,
                    category,
                    title: true,
                    hadCustomDynamicSampling: isAm3Ds,
                  });
                  const settingReservedBudget = this.isSettingReservedBudget(category);
                  const isDisabled =
                    settingReservedBudget &&
                    (category === DataCategory.SPANS_INDEXED ||
                      category === DataCategory.SEER_SCANNER);
                  const suffix =
                    settingReservedBudget &&
                    (category === DataCategory.SPANS ||
                      category === DataCategory.SEER_AUTOFIX)
                      ? ` (${toTitleCase(
                          Object.values(
                            selectedPlan?.availableReservedBudgetTypes ?? {}
                          ).find(budgetInfo =>
                            budgetInfo.dataCategories.includes(category)
                          )?.productName ?? ''
                        )} ARR)`
                      : '';
                  const capitalizedApiName = this.capitalizeForApiName(
                    categoryInfo.plural
                  );
                  return (
                    <StyledDollarsField
                      key={`customPrice${capitalizedApiName}`}
                      label={`Price for ${titleName}${suffix}`}
                      name={`customPrice${capitalizedApiName}`}
                      disabled={!hasCustomSkuPrices || isDisabled}
                      required={hasCustomSkuPrices}
                      value={isDisabled ? 0 : data[`customPrice${capitalizedApiName}`]}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            [`customPrice${capitalizedApiName}`]: v,
                          },
                        }))
                      }
                    />
                  );
                })}
                <StyledDollarsField
                  label="Price for PCSS"
                  name="customPricePcss"
                  disabled={!hasCustomSkuPrices}
                  required={hasCustomSkuPrices}
                  value={data.customPricePcss}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPricePcss: v,
                      },
                    }))
                  }
                />

                <StyledDollarsField
                  label="Annual Contract Value"
                  name="customPrice"
                  help="Used as a checksum, must be equal to sum of prices above"
                  required={hasCustomPrice}
                  disabled={!hasCustomPrice}
                  value={data.customPrice}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPrice: v,
                      },
                    }))
                  }
                />
              </div>
            </Columns>
          </Form>
        </Body>
      </Fragment>
    );
  }
}

const Columns = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(3)};
`;

const SectionHeader = styled('h5')`
  margin-bottom: 0;
`;

const SectionHeaderDescription = styled('small')`
  display: block;
  margin-bottom: ${space(3)};
`;

const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;

const StyledSelectFieldWithHelpText = styled(SelectField)`
  margin-bottom: 15px;

  div[class*='StyledSelectControl'] {
    margin-bottom: 0;
  }
`;

const StyledDollarsField = styled(DollarsField)`
  div[class='dollars-field-container'] {
    display: flex;
  }

  span[class='dollar-sign'] {
    padding: 12px;
  }
`;

const StyledDollarsAndCentsField = styled(DollarsAndCentsField)`
  div[class='dollars-cents-field-container'] {
    display: flex;
  }

  span[class='dollar-sign'] {
    padding: 12px;
  }
`;

const Modal = withApi(ProvisionSubscriptionModal);

type Options = Pick<
  Props,
  'orgId' | 'subscription' | 'onSuccess' | 'billingConfig' | 'organization'
>;

const triggerProvisionSubscription = (opts: Options) =>
  openModal(deps => <Modal {...deps} {...opts} />, {modalCss});

export default triggerProvisionSubscription;
