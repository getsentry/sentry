import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import BooleanField from 'sentry/components/deprecatedforms/booleanField';
import DateTimeField from 'sentry/components/deprecatedforms/dateTimeField';
import Form from 'sentry/components/deprecatedforms/form';
import InputField from 'sentry/components/deprecatedforms/inputField';
import NumberField from 'sentry/components/deprecatedforms/numberField';
import SelectField from 'sentry/components/deprecatedforms/selectField';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';
import {capitalize} from 'sentry/utils/string/capitalize';
import withApi from 'sentry/utils/withApi';

import {prettyDate} from 'admin/utils';
import {CPE_MULTIPLIER_TO_CENTS, RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {
  BillingConfig,
  Plan,
  ReservedBudgetMetricHistory,
  Subscription,
} from 'getsentry/types';
import {
  getAmPlanTier,
  isAm3DsPlan,
  isAm3Plan,
  isAmEnterprisePlan,
  isAmPlan,
  isTrialPlan,
} from 'getsentry/utils/billing';

const CPE_DECIMAL_PRECISION = 8;

// TODO: replace with modern fields so we don't need these workarounds
class DateField extends DateTimeField {
  getType() {
    return 'date';
  }
}

type DollarsAndCentsFieldProps = {
  max?: number;
  min?: number;
  step?: any;
} & NumberField['props'];

class DollarsField extends NumberField {
  getField() {
    return (
      <div className="dollars-field-container">
        <span className="dollar-sign">$</span>
        {super.getField()}
      </div>
    );
  }
}

class DollarsAndCentsField extends InputField<DollarsAndCentsFieldProps> {
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

type Props = {
  api: Client;
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
  canProvisionDsPlan?: boolean; // TODO(DS Spans): remove once we need to provision DS plans
};

type ModalProps = ModalRenderProps & Props;

type ModalState = {
  data: any;
  // TODO(ts), TODO:categories get data.plan categories to dynamically create fields
  effectiveAtDisabled: boolean;
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
    data: {},
    effectiveAtDisabled: false,
    provisionablePlans: {},
  };

  componentDidMount() {
    this.initializeState();
  }

  initializeState() {
    const {subscription, canProvisionDsPlan} = this.props;
    const existingPlanWithoutSuffix = subscription.plan.endsWith('_auf')
      ? subscription.plan.slice(0, subscription.plan.length - 4)
      : subscription.plan.endsWith('_ac')
        ? subscription.plan.slice(0, subscription.plan.length - 3)
        : subscription.plan;
    const existingPlanIsEnterprise = Object.keys(this.state.provisionablePlans).some(
      plan => plan[0] === existingPlanWithoutSuffix
    );

    if (existingPlanIsEnterprise) {
      const reservedBudgets = subscription.reservedBudgets;
      const reservedBudgetMetricHistories: Record<string, ReservedBudgetMetricHistory> =
        {};
      reservedBudgets?.forEach(budget => {
        Object.entries(budget.categories).forEach(([category, info]) => {
          reservedBudgetMetricHistories[category] = info;
        });
      });

      const infoFromMetricHistories: Record<string, any> = {};
      Object.entries(subscription.categories).forEach(([category, info]) => {
        const suffix = capitalize(category);
        infoFromMetricHistories[`reserved${suffix}`] = info.reserved;
        infoFromMetricHistories[`softCapType${suffix}`] = info.softCapType;
        infoFromMetricHistories[`customPrice${suffix}`] = toAnnualDollars(
          info.customPrice,
          subscription.billingInterval
        );
        infoFromMetricHistories[`paygCpe${suffix}`] = toDollars(
          info.paygCpe,
          CPE_DECIMAL_PRECISION
        );
        infoFromMetricHistories[`reservedCpe${suffix}`] = toDollars(
          reservedBudgetMetricHistories[category]?.reservedCpe,
          CPE_DECIMAL_PRECISION
        );
        infoFromMetricHistories[`paygCpe${suffix}`] = toDollars(
          info.paygCpe,
          CPE_DECIMAL_PRECISION
        );
        infoFromMetricHistories[`reservedCpe${suffix}`] = toDollars(
          reservedBudgetMetricHistories[category]?.reservedCpe,
          CPE_DECIMAL_PRECISION
        );
      });
      this.setState(state => ({
        ...state,
        data: {
          ...state.data,
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
          ...infoFromMetricHistories,
        },
      }));
    }
    this.fetchPlanData(canProvisionDsPlan ?? false);
  }

  fetchPlanData = async (canProvisionDsPlan: boolean) => {
    const billingConfig: BillingConfig = await this.props.api.requestPromise(
      `/customers/${this.props.orgId}/billing-config/?tier=all`
    );
    billingConfig.planList
      .filter(
        (plan: Plan) =>
          (isAmEnterprisePlan(plan.id) ||
            plan.id === 'e1' ||
            plan.id === 'mm2_a' ||
            plan.id === 'mm2_b') &&
          !plan.id.endsWith('_ac') &&
          !plan.id.endsWith('_auf') &&
          !isTrialPlan(plan.id) &&
          (isAm3DsPlan(plan.id) ? canProvisionDsPlan : true)
      )
      .forEach((plan: Plan) => {
        this.setState(state => ({
          ...state,
          provisionablePlans: {
            ...state.provisionablePlans,
            [plan.id]: plan,
          },
        }));
      });
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

  /**
   * If the user has set reserved CPEs for both span categories, assume we're setting the spans budget
   * NOTE: this and probably the way we let users set reserved budgets in this form will need to
   * change if we ever allowed reserved budgets for other subsets of categories
   */
  isSettingSpansBudget = () =>
    isAm3DsPlan(this.state.data.plan) &&
    Object.entries(this.state.data)
      .filter(([key, _]) => key.startsWith('reservedCpeSpans'))
      .every(([_, value]) => value !== null && value !== 0);

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
    this.state.data.customPriceSpans;

  /**
   * If the user is changing the on-demand max spend mode or disabling it,
   * don't retain the customer's existing on-demand max spend settings.
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
    const postData = {...this.state.data};

    for (const k in formData) {
      if (formData[k] !== '' && formData[k] !== null) {
        postData[k] = formData[k];
      }
    }

    // clear disabled fields
    if (postData.atPeriodEnd || postData.coterm) {
      delete postData.effectiveAt;
    }

    if (!postData.coterm) {
      delete postData.coterm;
    }

    const hasCustomSkuPrices = isAmEnterprisePlan(postData.plan);
    if (!hasCustomSkuPrices) {
      const customSkuFields = Object.keys(postData).filter(key =>
        key.startsWith('customPrice')
      );
      customSkuFields.forEach(key => {
        delete postData[key];
      });
    }

    const allCategories = Object.values(DATA_CATEGORY_INFO).map(c => c.plural);
    const planCategories = this.state.provisionablePlans[postData.plan]?.categories ?? [];
    allCategories.forEach(category => {
      if (!planCategories.includes(category)) {
        delete postData[`reserved${category}`];
        delete postData[`customPrice${category}`];
        delete postData[`softCapType${category}`];
        delete postData[`paygCpe${category}`];
        delete postData[`reservedCpe${category}`];
      }
    });

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

    Object.entries(postData).forEach(([key, value]) => {
      if (
        (key.startsWith('payCpe') || key.startsWith('reservedCpe')) &&
        !isNaN(value as number)
      ) {
        postData[key] = toCpeCents(value as number); // price should be in 0.000001 cents
      } else if (key.startsWith('customPrice') && !isNaN(value as number)) {
        postData[key] = toCents(value as number); // price should be in cents
      }
    });
    const hasCustomPrice = hasCustomSkuPrices || postData.managed;
    if (!hasCustomPrice) {
      delete postData.hasCustomPrice;
    }

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

    postData.retainOnDemandBudget = postData.retainOnDemandBudget
      ? !this.disableRetainOnDemand()
      : false;

    if (isAmPlan(postData.plan)) {
      // Setting soft cap types to null if not `ON_DEMAND` or `TRUE_FORWARD` ensures soft cap type
      // is disabled if it was set but is not set with the new provisioning request.
      postData.trueForward = {};
      Object.entries(postData).forEach(([key, value]) => {
        if (key.startsWith('softCapType')) {
          if (!value) {
            postData[key] = null;
          }
          postData.trueForward = {
            [key.replace('softCapType', '').toLowerCase()]: value === 'TRUE_FORWARD',
          };
        }
      });
    }

    if (isAm3DsPlan(postData.plan)) {
      if (this.hasCompleteSpansBudget()) {
        postData.reservedBudgets = [
          {
            categories: [
              DATA_CATEGORY_INFO[DataCategoryExact.SPAN].plural,
              DATA_CATEGORY_INFO[DataCategoryExact.SPAN_INDEXED].plural,
            ],
            budget: postData.customPriceSpans,
          },
        ];
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
    const {Header, Body, closeModal} = this.props;
    const {data} = this.state;

    const isAmEnt = isAmEnterprisePlan(data.plan);
    const isAm3Ds = isAm3DsPlan(data.plan);
    const hasCustomSkuPrices = isAmEnt;
    const hasCustomPrice = hasCustomSkuPrices || !!data.managed; // Refers to ACV

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
                      : {
                          ...Object.values(DATA_CATEGORY_INFO).map(categoryInfo => {
                            return {
                              [`customPrice${categoryInfo.plural}`]: '',
                            };
                          }),
                          customPricePcss: '',
                          customPrice: '',
                        };
                    const nextReservedCpes = chosenPlanIsAm3Ds
                      ? {}
                      : {
                          ...Object.values(DATA_CATEGORY_INFO).map(categoryInfo => {
                            return {
                              [`reservedCpe${categoryInfo.plural}`]: '',
                            };
                          }),
                        };

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
                    label="On-Demand Max Spend Setting"
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
                    help="Used to enable (Shared or Per Category) or disable on-demand max spend for invoiced customers. Cannot be provisioned with soft cap."
                    clearable
                    disabled={
                      this.state.data.type === 'credit_card' || this.isEnablingSoftCap()
                    }
                    value={this.state.data.onDemandInvoicedManual}
                    onChange={v =>
                      this.setState(state => ({
                        ...state,
                        data: {...state.data, onDemandInvoicedManual: v},
                      }))
                    }
                  />
                )}

                {!this.disableRetainOnDemand() && (
                  <BooleanField
                    label="Retain On-Demand Budget"
                    name="retainOnDemandBudget"
                    value={this.state.data.retainOnDemandBudget}
                    help="Check to retain the customer's current On-Demand Budget. Otherwise, the customer's On-Demand Budget will be set based on the default calculations (0.5 times the monthly plan price)."
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
                {this.state.data.plan &&
                  (this.state.provisionablePlans[this.state.data.plan]?.categories
                    .length ?? 0) > 0 && (
                    <Fragment>
                      <SectionHeader>Plan Quotas</SectionHeader>
                      <SectionHeaderDescription>
                        Monthly quantities for each SKU
                      </SectionHeaderDescription>
                      {Object.entries(DATA_CATEGORY_INFO)
                        .filter(
                          ([_, categoryInfo]) =>
                            this.state.data.plan &&
                            this.state.provisionablePlans[
                              this.state.data.plan
                            ]?.categories.includes(categoryInfo.plural)
                        )
                        .map(([category, categoryInfo]) => {
                          const titleName =
                            category === DataCategoryExact.SPAN && isAm3Ds
                              ? 'Accepted Spans'
                              : categoryInfo.titleName;
                          const suffix =
                            category === DataCategoryExact.ATTACHMENT
                              ? ' (in GB)'
                              : category === DataCategoryExact.PROFILE_DURATION
                                ? ' (in hours)'
                                : '';
                          const capitalizedApiName = capitalize(categoryInfo.plural);
                          return (
                            <Fragment key={categoryInfo.plural}>
                              <NumberField
                                label={`Reserved ${titleName}${suffix}`}
                                name={`reserved${capitalizedApiName}`}
                                required={
                                  category === DataCategoryExact.ERROR
                                    ? !!data.plan
                                    : isAmEnt
                                }
                                disabled={
                                  [
                                    DataCategoryExact.SPAN,
                                    DataCategoryExact.SPAN_INDEXED,
                                  ].includes(category as DataCategoryExact) &&
                                  this.state.data[`reservedCpe${capitalizedApiName}`]
                                }
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
                                value={
                                  this.state.data[`softCapType${capitalizedApiName}`]
                                }
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
                              {[
                                DataCategoryExact.SPAN,
                                DataCategoryExact.SPAN_INDEXED,
                              ].includes(category as DataCategoryExact) && (
                                <StyledDollarsAndCentsField
                                  label={`Reserved Cost-Per-${titleName}`}
                                  name={`reservedCpe${capitalizedApiName}`}
                                  disabled={!isAm3Ds}
                                  value={data[`reservedCpe${capitalizedApiName}`]}
                                  step={0.00000001}
                                  min={0.00000001}
                                  max={1}
                                  onChange={v =>
                                    this.setState(state => ({
                                      ...state,
                                      data: {
                                        ...state.data,
                                        [`reservedCpe${capitalizedApiName}`]: v,
                                      },
                                    }))
                                  }
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
                                  label={`On-Demand Cost-Per-${titleName}`}
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
                    </Fragment>
                  )}
              </div>
              <div>
                <SectionHeader>Reserved Volume Prices</SectionHeader>
                <SectionHeaderDescription>
                  Annual prices for reserved volumes, in whole dollars.
                </SectionHeaderDescription>
                {Object.entries(DATA_CATEGORY_INFO)
                  .filter(
                    ([_, categoryInfo]) =>
                      this.state.data.plan &&
                      this.state.provisionablePlans[
                        this.state.data.plan
                      ]?.categories.includes(categoryInfo.plural)
                  )
                  .map(([category, categoryInfo]) => {
                    const titleName =
                      category === DataCategoryExact.SPAN && isAm3Ds
                        ? 'Accepted Spans'
                        : categoryInfo.titleName;
                    const suffix =
                      category === DataCategoryExact.SPAN &&
                      isAm3DsPlan(this.state.data.plan)
                        ? ' (Reserved Spans Budget)'
                        : '';
                    const capitalizedApiName = capitalize(categoryInfo.plural);
                    return (
                      <StyledDollarsField
                        key={`customPrice${capitalizedApiName}`}
                        label={`Price for ${titleName}${suffix}`}
                        name={`customPrice${capitalizedApiName}`}
                        disabled={!hasCustomSkuPrices}
                        required={hasCustomSkuPrices}
                        value={data[`customPrice${capitalizedApiName}`]}
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

type Options = Pick<Props, 'orgId' | 'subscription' | 'onSuccess' | 'canProvisionDsPlan'>;

const triggerProvisionSubscription = (opts: Options) =>
  openModal(deps => <Modal {...deps} {...opts} />, {modalCss});

export default triggerProvisionSubscription;
