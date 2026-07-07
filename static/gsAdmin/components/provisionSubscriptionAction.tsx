import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import upperFirst from 'lodash/upperFirst';

import {Input} from '@sentry/scraps/input';
import {Select} from '@sentry/scraps/select';
import {Switch} from '@sentry/scraps/switch';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {withApi} from 'sentry/utils/withApi';

import {prettyDate} from 'admin/utils';
import {
  CPE_MULTIPLIER_TO_CENTS,
  MONTHLY,
  RESERVED_BUDGET_QUOTA,
} from 'getsentry/constants';
import {
  ReservedBudgetCategoryType,
  type BillingConfig,
  type Plan,
  type ReservedBudgetMetricHistory,
  type Subscription,
} from 'getsentry/types';
import {displayBudgetName, hasPerformance} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  isByteCategory,
} from 'getsentry/utils/dataCategory';

const CPE_DECIMAL_PRECISION = 8;

type Props = {
  api: Client;
  billingConfig: BillingConfig | null;
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
};

type ModalProps = ModalRenderProps & Props;

type ModalState = {
  data: any;
  // TODO(ts)
  effectiveAtDisabled: boolean;
  errorMessage: string | null;
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

/**
 * Minimal field wrapper that replicates the deprecated FormField's DOM structure.
 * Renders: label[htmlFor] -> input[id] association for accessibility.
 */
function FormFieldWrapper({
  label,
  name,
  help,
  children,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
  help?: string;
}) {
  return (
    <div className="control-group">
      <div className="controls">
        <label htmlFor={`id-${name}`} className="control-label">
          {label}
        </label>
        {children}
        {help ? <p className="help-block">{help}</p> : null}
      </div>
    </div>
  );
}

/**
 * Select field wrapper - does NOT use htmlFor since react-select has its own
 * labeling via aria-label on the internal input.
 */
function SelectFieldWrapper({
  label,
  name,
  help,
  children,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
  help?: string;
}) {
  return (
    <div className="control-group">
      <div className="controls">
        <label htmlFor={`id-${name}`} className="control-label">
          {label}
        </label>
        {children}
        {help ? <p className="help-block">{help}</p> : null}
      </div>
    </div>
  );
}

class ProvisionSubscriptionModal extends Component<ModalProps, ModalState> {
  state: ModalState = {
    isLoading: true,
    data: {},
    effectiveAtDisabled: false,
    provisionablePlans: {},
    errorMessage: null,
  };

  componentDidMount() {
    this.initializeState();
    this.setState({isLoading: false});
  }

  initializeState() {
    const {subscription, billingConfig} = this.props;

    const provisionablePlans = billingConfig
      ? billingConfig.planList.reduce<Record<string, Plan>>((acc, plan) => {
          if (
            plan.isEnterprise &&
            // Legacy errors-only enterprise plans (e1, mm2) can no longer be
            // provisioned.
            hasPerformance(plan) &&
            plan.billingInterval === MONTHLY
          ) {
            acc[plan.id] = plan;
          }
          return acc;
        }, {})
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

  isReservedBudgetCategory = (category: DataCategory): boolean => {
    const seerCategories = [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER];

    return seerCategories.includes(category);
  };

  /**
   * If the user has set reserved CPEs for both Seer categories, assume we're setting the Seer budget
   * NOTE: this and probably the way we let users set reserved budgets in this form will need to
   * change if we ever allowed reserved budgets for other subsets of categories
   */
  isSettingSeerBudget = () =>
    Object.entries(this.state.data)
      .filter(
        ([key, _]) =>
          key.startsWith('reservedCpeSeerAutofix') ||
          key.startsWith('reservedCpeSeerScanner')
      )
      .every(([_, value]) => value !== null && value !== undefined) &&
    Object.keys(this.state.data).filter(
      key =>
        key.startsWith('reservedCpeSeerAutofix') ||
        key.startsWith('reservedCpeSeerScanner')
    ).length >= 2;

  isSettingReservedBudget = (category: DataCategory) => {
    if (
      category === DataCategory.SEER_AUTOFIX ||
      category === DataCategory.SEER_SCANNER
    ) {
      return this.isSettingSeerBudget();
    }
    return false;
  };

  /**
   * Whether the user has set all the required fields to provision a Seer budget.
   * These include the reserved CPEs and reserved volumes for each Seer category,
   * as well as a budget amount.
   */
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

  onSubmitError = (errorData: {responseJSON: Record<string, any>}) => {
    // Display first error message found
    const errors = errorData.responseJSON;
    if (errors) {
      const firstKey = Object.keys(errors)[0];
      if (firstKey) {
        const errorValue = errors[firstKey];
        const message = Array.isArray(errorValue)
          ? errorValue[0]
          : typeof errorValue === 'string'
            ? errorValue
            : JSON.stringify(errorValue);
        this.setState({errorMessage: message});
      }
    }
  };

  handleSubmit = () => {
    this.setState({errorMessage: null});
    const postData: Record<string, any> = {...this.state.data};

    // Ensure numeric fields are numbers, not strings (Input onChange gives strings)
    for (const key of Object.keys(postData)) {
      const val = postData[key];
      if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) {
        if (
          key.startsWith('reserved') ||
          key.startsWith('customPrice') ||
          key.startsWith('paygCpe') ||
          key.startsWith('reservedCpe') ||
          key === 'seerBudget'
        ) {
          postData[key] = Number(val);
        }
      }
    }

    // Ensure managed reflects the displayed value (plan selected = managed)
    const hasCustomSkuPricesForManaged = Boolean(postData.plan);
    if (hasCustomSkuPricesForManaged) {
      postData.managed = true;
    }

    // clear conflicting fields regarding when the changes take effect
    if (postData.atPeriodEnd || postData.coterm) {
      delete postData.effectiveAt;
    }
    if (!postData.coterm) {
      delete postData.coterm;
    }

    // remove custom price fields if no plan is selected; every provisionable
    // plan is AM Enterprise and has custom SKU prices
    const hasCustomSkuPrices = Boolean(postData.plan);
    if (!hasCustomSkuPrices) {
      const customSkuFields = Object.keys(postData).filter(
        key => key.startsWith('customPrice') && key !== 'customPrice'
      );
      customSkuFields.forEach(key => {
        delete postData[key];
      });
    }

    const allCategories = Object.values(DATA_CATEGORY_INFO).map(c => c.plural);
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
        typeof value === 'number'
      ) {
        postData[key] = toCpeCents(value);
      } else if (
        (key.startsWith('customPrice') || key === 'seerBudget') &&
        typeof value === 'number'
      ) {
        postData[key] = toCents(value);
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
        this.onSubmitError({
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

    if (postData.plan) {
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
        this.onSubmitError({
          responseJSON: error.responseJSON,
        });
      },
    });
  };

  render() {
    const {Header, Body, closeModal} = this.props;
    const {data} = this.state;

    // every provisionable plan is AM Enterprise and has custom SKU prices
    const hasCustomSkuPrices = Boolean(data.plan);
    const hasCustomPrice = hasCustomSkuPrices || !!data.managed; // Refers to ACV
    const selectedPlan = this.state.provisionablePlans[data.plan];

    if (this.state.isLoading) {
      return <LoadingIndicator />;
    }

    return (
      <Fragment>
        <Header>Provision Subscription Changes</Header>
        <Body>
          <form
            onSubmit={e => {
              e.preventDefault();
              this.handleSubmit();
            }}
          >
            {this.state.errorMessage ? (
              <div className="alert alert-error">{this.state.errorMessage}</div>
            ) : null}
            <Columns>
              <div>
                <SelectFieldWrapper label="Plan" name="plan">
                  <Select
                    name="plan"
                    inputId="id-plan"
                    aria-label="Plan"
                    clearable={false}
                    choices={Object.entries(this.state.provisionablePlans)
                      .reverse()
                      .map(
                        ([id, plan]) =>
                          [id, `${plan.name} (${plan.id})`] as [string, string]
                      )}
                    onChange={(option: any) => {
                      const v = option?.value;
                      // Reset reserved CPEs when changing plans
                      const nextReservedCpes = Object.keys(this.state.data)
                        .filter(key => key.startsWith('reservedCpe'))
                        .reduce<Record<string, null>>((acc, key) => {
                          return {...acc, [key]: null};
                        }, {});
                      this.setState(state => ({
                        ...state,
                        data: {
                          ...state.data,
                          plan: v,
                          ...nextReservedCpes,
                        },
                      }));
                    }}
                    value={this.state.data.plan}
                  />
                </SelectFieldWrapper>
                <FormFieldWrapper
                  label={`Apply Changes at the End of the Current Billing Period (${prettyDate(
                    this.props.subscription.billingPeriodEnd
                  )})`}
                  name="atPeriodEnd"
                >
                  <Switch
                    id="id-atPeriodEnd"
                    disabled={this.state.data.coterm}
                    checked={!!this.state.data.atPeriodEnd}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const v = e.target.checked;
                      this.setState(state => ({
                        ...state,
                        effectiveAtDisabled: !!v,
                        data: {...state.data, atPeriodEnd: v},
                      }));
                    }}
                  />
                </FormFieldWrapper>
                <FormFieldWrapper
                  label="Apply Changes To Current Subscription"
                  name="coterm"
                >
                  <Switch
                    id="id-coterm"
                    disabled={this.state.data.atPeriodEnd}
                    checked={!!this.state.data.coterm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const v = e.target.checked;
                      this.setState(state => ({
                        ...state,
                        data: {...state.data, coterm: v},
                        effectiveAtDisabled: !!v,
                      }));
                    }}
                  />
                </FormFieldWrapper>
                <FormFieldWrapper
                  label="Start Date"
                  name="effectiveAt"
                  help="The date at which this change should take effect."
                >
                  <Input
                    id="id-effectiveAt"
                    type="date"
                    name="effectiveAt"
                    disabled={this.state.effectiveAtDisabled}
                    required={!this.state.effectiveAtDisabled}
                    value={this.state.data.effectiveAt ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      this.setState(state => ({
                        ...state,
                        data: {...state.data, effectiveAt: e.target.value},
                      }))
                    }
                  />
                </FormFieldWrapper>
                <SelectFieldWrapper label="Billing Interval" name="billingInterval">
                  <Select
                    name="billingInterval"
                    inputId="id-billingInterval"
                    aria-label="Billing Interval"
                    choices={[
                      ['annual', 'Annual'],
                      ['monthly', 'Monthly'],
                    ]}
                    disabled={!this.state.data.plan}
                    value={this.state.data.billingInterval}
                    onChange={(option: any) => {
                      const v = option?.value;
                      this.setState(state => ({
                        ...state,
                        data: {
                          ...this.state.data,
                          billingInterval: v,
                        },
                      }));
                    }}
                  />
                </SelectFieldWrapper>
                <FormFieldWrapper label="Managed Subscription" name="managed">
                  <Switch
                    id="id-managed"
                    checked={!!(hasCustomSkuPrices || this.state.data.managed)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const v = e.target.checked;
                      this.setState(state => ({
                        ...state,
                        data: {
                          ...state.data,
                          managed: v,
                          customPrice: v ? state.data.customPrice : '',
                        },
                      }));
                    }}
                  />
                </FormFieldWrapper>

                <SelectFieldWrapper label="Billing Type" name="type">
                  <Select
                    name="type"
                    inputId="id-type"
                    aria-label="Billing Type"
                    choices={[
                      ['invoiced', 'Invoiced'],
                      ['credit_card', 'Credit Card'],
                    ]}
                    onChange={(option: any) => {
                      const v = option?.value;
                      if (v === 'credit_card') {
                        this.setState(state => ({
                          ...state,
                          data: {...state.data, onDemandInvoicedManual: ''},
                        }));
                      }
                      this.setState(state => ({
                        ...state,
                        data: {...state.data, type: v},
                      }));
                    }}
                    value={this.state.data.type}
                  />
                </SelectFieldWrapper>
                {this.state.data.type === 'invoiced' && (
                  <SelectFieldWrapper
                    label={`${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Max Spend Setting`}
                    name="onDemandInvoicedManual"
                    help={`Used to enable (Shared or Per Category) or disable ${selectedPlan ? displayBudgetName(selectedPlan) : 'pay-as-you-go'} max spend for invoiced customers. Cannot be provisioned with soft cap.`}
                  >
                    <Select
                      name="onDemandInvoicedManual"
                      inputId="id-onDemandInvoicedManual"
                      aria-label={`${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Max Spend Setting`}
                      choices={
                        // per-category max spend is only available on plans
                        // with on-demand budget modes
                        selectedPlan && !selectedPlan.hasOnDemandModes
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
                      clearable
                      disabled={
                        this.state.data.type === 'credit_card' || this.isEnablingSoftCap()
                      }
                      value={this.state.data.onDemandInvoicedManual}
                      onChange={(option: any) => {
                        const v = option?.value;
                        this.setState(state => ({
                          ...state,
                          data: {...state.data, onDemandInvoicedManual: v ? v : null},
                        }));
                      }}
                    />
                  </SelectFieldWrapper>
                )}

                {!this.disableRetainOnDemand() && (
                  <FormFieldWrapper
                    label={`Retain ${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Budget`}
                    name="retainOnDemandBudget"
                    help={`Check to retain the customer's current ${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Budget. Otherwise, the customer's ${selectedPlan ? displayBudgetName(selectedPlan) : 'Pay-as-you-go'} Budget will be set based on the default calculations (0.5 times the monthly plan price).`}
                  >
                    <Switch
                      id="id-retainOnDemandBudget"
                      checked={!!this.state.data.retainOnDemandBudget}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.checked;
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            retainOnDemandBudget: v,
                          },
                        }));
                      }}
                    />
                  </FormFieldWrapper>
                )}
                {selectedPlan && (selectedPlan?.categories.length ?? 0) > 0 && (
                  <Fragment>
                    <SectionHeader>Plan Quotas</SectionHeader>
                    <SectionHeaderDescription>
                      Monthly quantities for each SKU
                    </SectionHeaderDescription>
                    {selectedPlan?.categories.map(category => {
                      const categoryInfo = getCategoryInfoFromPlural(category);
                      if (!categoryInfo) {
                        return null;
                      }
                      const titleName = getPlanCategoryName({
                        plan: selectedPlan,
                        category,
                        title: true,
                      });
                      const suffix = isByteCategory(category) ? ' (in GB)' : '';
                      const capitalizedApiName = this.capitalizeForApiName(
                        categoryInfo.plural
                      );
                      return (
                        <Fragment key={categoryInfo.plural}>
                          <FormFieldWrapper
                            label={`Reserved ${titleName}${suffix}`}
                            name={`reserved${capitalizedApiName}`}
                          >
                            <Input
                              id={`id-reserved${capitalizedApiName}`}
                              type="number"
                              name={`reserved${capitalizedApiName}`}
                              required
                              disabled={
                                Number(
                                  this.state.data[`reservedCpe${capitalizedApiName}`]
                                ) > 0
                              }
                              value={
                                this.state.data[`reserved${capitalizedApiName}`] ?? ''
                              }
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                this.setState(state => ({
                                  ...state,
                                  data: {
                                    ...state.data,
                                    [`reserved${capitalizedApiName}`]: e.target.value
                                      ? Number(e.target.value)
                                      : '',
                                  },
                                }))
                              }
                            />
                          </FormFieldWrapper>
                          <SelectFieldWrapper
                            label={`Soft Cap Type ${titleName}`}
                            name={`softCapType${capitalizedApiName}`}
                          >
                            <Select
                              name={`softCapType${capitalizedApiName}`}
                              inputId={`id-softCapType${capitalizedApiName}`}
                              aria-label={`Soft Cap Type ${titleName}`}
                              clearable
                              choices={[
                                ['ON_DEMAND', 'On Demand'],
                                ['TRUE_FORWARD', 'True Forward'],
                              ]}
                              disabled={this.isEnablingOnDemandMaxSpend()}
                              value={this.state.data[`softCapType${capitalizedApiName}`]}
                              onChange={(option: any) => {
                                const v = option?.value;
                                this.setState(state => ({
                                  ...state,
                                  data: {
                                    ...state.data,
                                    [`softCapType${capitalizedApiName}`]: v ? v : null,
                                  },
                                }));
                              }}
                            />
                          </SelectFieldWrapper>
                          {this.isReservedBudgetCategory(category) && (
                            <FormFieldWrapper
                              label={`Reserved Cost-Per-Event ${titleName}`}
                              name={`reservedCpe${capitalizedApiName}`}
                            >
                              <DollarsAndCentsContainer>
                                <span className="dollar-sign">$</span>
                                <Input
                                  id={`id-reservedCpe${capitalizedApiName}`}
                                  type="number"
                                  name={`reservedCpe${capitalizedApiName}`}
                                  step={0.00000001}
                                  min={0}
                                  max={1}
                                  value={data[`reservedCpe${capitalizedApiName}`] ?? ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const v = e.target.value;
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
                              </DollarsAndCentsContainer>
                            </FormFieldWrapper>
                          )}
                          {this.isEnablingOnDemandMaxSpend() && (
                            <FormFieldWrapper
                              label={`${selectedPlan ? displayBudgetName(selectedPlan, {title: true}) : 'Pay-as-you-go'} Cost-Per-Event ${titleName}`}
                              name={`paygCpe${capitalizedApiName}`}
                            >
                              <DollarsAndCentsContainer>
                                <span className="dollar-sign">$</span>
                                <Input
                                  id={`id-paygCpe${capitalizedApiName}`}
                                  type="number"
                                  name={`paygCpe${capitalizedApiName}`}
                                  step={0.00000001}
                                  min={0.00000001}
                                  max={1}
                                  required
                                  value={data[`paygCpe${capitalizedApiName}`] ?? ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    this.setState(state => ({
                                      ...state,
                                      data: {
                                        ...state.data,
                                        [`paygCpe${capitalizedApiName}`]: e.target.value,
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
                              </DollarsAndCentsContainer>
                            </FormFieldWrapper>
                          )}
                        </Fragment>
                      );
                    })}
                    {this.isSettingSeerBudget() && (
                      <FormFieldWrapper
                        label="Seer Budget"
                        name="seerBudget"
                        help="Monthly reserved budget for Seer"
                      >
                        <DollarsContainer>
                          <span className="dollar-sign">$</span>
                          <Input
                            id="id-seerBudget"
                            type="number"
                            name="seerBudget"
                            required={this.isSettingSeerBudget()}
                            value={data.seerBudget ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              this.setState(state => ({
                                ...state,
                                data: {
                                  ...state.data,
                                  seerBudget: e.target.value
                                    ? Number(e.target.value)
                                    : '',
                                },
                              }))
                            }
                          />
                        </DollarsContainer>
                      </FormFieldWrapper>
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
                  if (!categoryInfo) {
                    return null;
                  }
                  const titleName = getPlanCategoryName({
                    plan: selectedPlan,
                    category,
                    title: true,
                  });
                  const settingReservedBudget = this.isSettingReservedBudget(category);
                  const isDisabled =
                    settingReservedBudget && category === DataCategory.SEER_SCANNER;
                  const priceSuffix =
                    settingReservedBudget && category === DataCategory.SEER_AUTOFIX
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
                    <FormFieldWrapper
                      key={`customPrice${capitalizedApiName}`}
                      label={`Price for ${titleName}${priceSuffix}`}
                      name={`customPrice${capitalizedApiName}`}
                    >
                      <DollarsContainer>
                        <span className="dollar-sign">$</span>
                        <Input
                          id={`id-customPrice${capitalizedApiName}`}
                          type="number"
                          name={`customPrice${capitalizedApiName}`}
                          disabled={!hasCustomSkuPrices || isDisabled}
                          required={hasCustomSkuPrices}
                          value={
                            isDisabled
                              ? 0
                              : (data[`customPrice${capitalizedApiName}`] ?? '')
                          }
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            this.setState(state => ({
                              ...state,
                              data: {
                                ...state.data,
                                [`customPrice${capitalizedApiName}`]: e.target.value
                                  ? Number(e.target.value)
                                  : '',
                              },
                            }))
                          }
                        />
                      </DollarsContainer>
                    </FormFieldWrapper>
                  );
                })}
                <FormFieldWrapper label="Price for PCSS" name="customPricePcss">
                  <DollarsContainer>
                    <span className="dollar-sign">$</span>
                    <Input
                      id="id-customPricePcss"
                      type="number"
                      name="customPricePcss"
                      disabled={!hasCustomSkuPrices}
                      required={hasCustomSkuPrices}
                      value={data.customPricePcss ?? ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            customPricePcss: e.target.value ? Number(e.target.value) : '',
                          },
                        }))
                      }
                    />
                  </DollarsContainer>
                </FormFieldWrapper>

                <FormFieldWrapper
                  label="Annual Contract Value"
                  name="customPrice"
                  help="Used as a checksum, must be equal to sum of prices above"
                >
                  <DollarsContainer>
                    <span className="dollar-sign">$</span>
                    <Input
                      id="id-customPrice"
                      type="number"
                      name="customPrice"
                      required={hasCustomPrice}
                      disabled={!hasCustomPrice}
                      value={data.customPrice ?? ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            customPrice: e.target.value ? Number(e.target.value) : '',
                          },
                        }))
                      }
                    />
                  </DollarsContainer>
                </FormFieldWrapper>
              </div>
            </Columns>
            <div className="modal-footer">
              <button type="button" className="btn btn-default" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Submit
              </button>
            </div>
          </form>
        </Body>
      </Fragment>
    );
  }
}

const Columns = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space['2xl']};
`;

const SectionHeader = styled('h5')`
  margin-bottom: 0;
`;

const SectionHeaderDescription = styled('small')`
  display: block;
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;

const DollarsContainer = styled('div')`
  display: flex;

  span[class='dollar-sign'] {
    padding: 12px;
  }
`;

const DollarsAndCentsContainer = styled('div')`
  display: flex;

  span[class='dollar-sign'] {
    padding: 12px;
  }
`;

const Modal = withApi(ProvisionSubscriptionModal);

type Options = Pick<Props, 'orgId' | 'subscription' | 'onSuccess' | 'billingConfig'>;

export const triggerProvisionSubscription = (opts: Options) =>
  openModal(deps => <Modal {...deps} {...opts} />, {modalCss});
