import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import BooleanField from 'sentry/components/deprecatedforms/booleanField';
import DateTimeField from 'sentry/components/deprecatedforms/dateTimeField';
import Form from 'sentry/components/deprecatedforms/form';
import InputField from 'sentry/components/deprecatedforms/inputField';
import NumberField from 'sentry/components/deprecatedforms/numberField';
import SelectField from 'sentry/components/deprecatedforms/selectField';
import {space} from 'sentry/styles/space';
import withApi from 'sentry/utils/withApi';

import {prettyDate} from 'admin/utils';
import {CPE_MULTIPLIER_TO_CENTS, RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {ReservedBudgetMetricHistory, Subscription} from 'getsentry/types';
import {
  isAm3DsPlan,
  isAm3Plan,
  isAmEnterprisePlan,
  isAmPlan,
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
  data: any; // TODO(ts), TODO:categories get data.plan categories to dynamically create fields
  effectiveAtDisabled: boolean;
};

function toAnnualDollars(
  cents: number | null | undefined,
  billingInterval: string | null | undefined,
  decimals = 0
) {
  if (typeof cents !== 'number') {
    return cents;
  }
  if (billingInterval === 'monthly') {
    return parseFloat(((cents * 12) / 100).toFixed(decimals));
  }
  return parseFloat((cents / 100).toFixed(decimals));
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
  };

  componentDidMount() {
    const {subscription} = this.props;
    const existingPlanWithoutSuffix = subscription.plan.endsWith('_auf')
      ? subscription.plan.slice(0, subscription.plan.length - 4)
      : subscription.plan.endsWith('_ac')
        ? subscription.plan.slice(0, subscription.plan.length - 3)
        : subscription.plan;
    const existingPlanIsEnterprise = this.provisionablePlans.some(
      plan => plan[0] === existingPlanWithoutSuffix
    );

    const reservedBudgets = subscription.reservedBudgets;
    const reservedBudgetMetricHistories: Record<string, ReservedBudgetMetricHistory> = {};
    reservedBudgets?.forEach(budget => {
      Object.entries(budget.categories).forEach(([category, info]) => {
        reservedBudgetMetricHistories[category] = info;
      });
    });

    if (existingPlanIsEnterprise) {
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
          reservedErrors: subscription.categories.errors?.reserved,
          reservedTransactions: subscription.categories.transactions?.reserved,
          reservedReplays: subscription.categories.replays?.reserved,
          reservedMonitorSeats: subscription.categories.monitorSeats?.reserved,
          reservedUptime: subscription.categories.uptime?.reserved,
          reservedSpans: subscription.categories.spans?.reserved,
          reservedSpansIndexed: subscription.categories.spansIndexed?.reserved,
          reservedAttachments: subscription.categories.attachments?.reserved,
          reservedProfileDuration: subscription.categories.profileDuration?.reserved,
          reservedProfileDurationUI: subscription.categories.profileDurationUI?.reserved,
          softCapTypeErrors: subscription.categories.errors?.softCapType,
          softCapTypeTransactions: subscription.categories.transactions?.softCapType,
          softCapTypeReplays: subscription.categories.replays?.softCapType,
          softCapTypeMonitorSeats: subscription.categories.monitorSeats?.softCapType,
          softCapTypeUptime: subscription.categories.uptime?.softCapType,
          softCapTypeSpans: subscription.categories.spans?.softCapType,
          softCapTypeSpansIndexed: subscription.categories.spansIndexed?.softCapType,
          softCapTypeAttachments: subscription.categories.attachments?.softCapType,
          softCapTypeProfileDuration:
            subscription.categories.profileDuration?.softCapType,
          softCapTypeProfileDurationUI:
            subscription.categories.profileDurationUI?.softCapType,
          customPriceErrors: toAnnualDollars(
            subscription.categories.errors?.customPrice,
            subscription.billingInterval
          ),
          customPriceTransactions: toAnnualDollars(
            subscription.categories.transactions?.customPrice,
            subscription.billingInterval
          ),
          customPriceReplays: toAnnualDollars(
            subscription.categories.replays?.customPrice,
            subscription.billingInterval
          ),
          customPriceMonitorSeats: toAnnualDollars(
            subscription.categories.monitorSeats?.customPrice,
            subscription.billingInterval
          ),
          customPriceUptime: toAnnualDollars(
            subscription.categories.uptime?.customPrice,
            subscription.billingInterval
          ),
          customPriceSpans: toAnnualDollars(
            subscription.categories.spans?.customPrice,
            subscription.billingInterval
          ),
          customPriceSpansIndexed: toAnnualDollars(
            subscription.categories.spansIndexed?.customPrice,
            subscription.billingInterval
          ),
          customPriceAttachments: toAnnualDollars(
            subscription.categories.attachments?.customPrice,
            subscription.billingInterval
          ),
          customPriceProfileDuration: toAnnualDollars(
            subscription.categories.profileDuration?.customPrice,
            subscription.billingInterval
          ),
          customPriceProfileDurationUI: toAnnualDollars(
            subscription.categories.profileDurationUI?.customPrice,
            subscription.billingInterval
          ),
          customPricePcss: toAnnualDollars(
            subscription.customPricePcss,
            subscription.billingInterval
          ),
          customPrice: toAnnualDollars(
            subscription.customPrice,
            subscription.billingInterval
          ),
          onDemandCpeErrors: toAnnualDollars(
            subscription.categories.errors?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeTransactions: toAnnualDollars(
            subscription.categories.transactions?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeReplays: toAnnualDollars(
            subscription.categories.replays?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeMonitorSeats: toAnnualDollars(
            subscription.categories.monitorSeats?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeUptime: toAnnualDollars(
            subscription.categories.uptime?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeSpans: toAnnualDollars(
            subscription.categories.spans?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeSpansIndexed: toAnnualDollars(
            subscription.categories.spansIndexed?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeAttachments: toAnnualDollars(
            subscription.categories.attachments?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeProfileDuration: toAnnualDollars(
            subscription.categories.profileDuration?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          onDemandCpeProfileDurationUI: toAnnualDollars(
            subscription.categories.profileDurationUI?.onDemandCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          // coming from the API, reservedCpe is in cents
          reservedCpeSpans: toAnnualDollars(
            reservedBudgetMetricHistories.spans?.reservedCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
          reservedCpeSpansIndexed: toAnnualDollars(
            reservedBudgetMetricHistories.spansIndexed?.reservedCpe,
            null,
            CPE_DECIMAL_PRECISION
          ),
        },
      }));
    }
  }

  get endpoint() {
    return `/customers/${this.props.orgId}/provision-subscription/`;
  }

  isEnablingOnDemandMaxSpend = () =>
    this.state.data.onDemandInvoicedManual === 'SHARED' ||
    this.state.data.onDemandInvoicedManual === 'PER_CATEGORY';

  isEnablingSoftCap = () =>
    this.state.data.softCapTypeErrors ||
    this.state.data.softCapTypeTransactions ||
    this.state.data.softCapTypeReplays ||
    this.state.data.softCapTypeMonitorSeats ||
    this.state.data.softCapTypeUptime ||
    this.state.data.softCapTypeSpans ||
    this.state.data.softCapTypeSpansIndexed ||
    this.state.data.softCapTypeAttachments;

  isSettingSpansBudget = () =>
    isAm3DsPlan(this.state.data.plan) &&
    this.state.data.reservedCpeSpans &&
    this.state.data.reservedCpeSpansIndexed;

  hasCompleteSpansBudget = () =>
    this.isSettingSpansBudget() &&
    this.state.data.reservedSpans === RESERVED_BUDGET_QUOTA &&
    this.state.data.reservedSpansIndexed === RESERVED_BUDGET_QUOTA &&
    this.state.data.customPriceSpans;

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
      delete postData.customPriceErrors;
      delete postData.customPriceTransactions;
      delete postData.customPriceAttachments;
      delete postData.customPricePcss;
      delete postData.customPriceReplays;
      delete postData.customPriceMonitorSeats;
      delete postData.customPriceUptime;
      delete postData.customPriceSpans;
      delete postData.customPriceSpansIndexed;
      delete postData.customPriceProfileDuration;
      delete postData.customPriceProfileDurationUI;
    }

    // only set reserved & custom price for spans OR transactions
    if (isAm3Plan(postData.plan)) {
      delete postData.reservedTransactions;
      delete postData.customPriceTransactions;
    } else {
      delete postData.reservedSpans;
      delete postData.customPriceSpans;
    }

    if (postData.type !== 'invoiced') {
      delete postData.onDemandInvoicedManual;
      delete postData.onDemandCpeErrors;
      delete postData.onDemandCpeTransactions;
      delete postData.onDemandCpeReplays;
      delete postData.onDemandCpeAttachments;
      delete postData.onDemandCpeMonitorSeats;
      delete postData.onDemandCpeUptime;
      delete postData.onDemandCpeSpans;
      delete postData.onDemandCpeProfileDuration;
      delete postData.onDemandCpeProfileDurationUI;

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
      postData.softCapTypeErrors = null;
      postData.softCapTypeTransactions = null;
      postData.softCapTypeReplays = null;
      postData.softCapTypeAttachments = null;
      postData.softCapTypeMonitorSeats = null;
      postData.softCapTypeUptime = null;
      postData.softCapTypeSpans = null;
      postData.softCapTypeProfileDuration = null;
      postData.softCapTypeProfileDurationUI = null;
      this.setState(state => ({
        ...state,
        data: {
          ...state.data,
          softCapTypeErrors: null,
          softCapTypeTransactions: null,
          softCapTypeReplays: null,
          softCapTypeAttachments: null,
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeSpans: null,
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
        },
      }));
    } else {
      delete postData.onDemandCpeErrors;
      delete postData.onDemandCpeTransactions;
      delete postData.onDemandCpeReplays;
      delete postData.onDemandCpeAttachments;
      delete postData.onDemandCpeMonitorSeats;
      delete postData.onDemandCpeUptime;
      delete postData.onDemandCpeSpans;
      delete postData.onDemandCpeProfileDuration;
      delete postData.onDemandCpeProfileDurationUI;
    }

    if (this.isEnablingSoftCap()) {
      postData.onDemandInvoicedManual = 'DISABLE';
      delete postData.onDemandCpeErrors;
      delete postData.onDemandCpeTransactions;
      delete postData.onDemandCpeReplays;
      delete postData.onDemandCpeAttachments;
      delete postData.onDemandCpeMonitorSeats;
      delete postData.onDemandCpeUptime;
      delete postData.onDemandCpeSpans;
      delete postData.onDemandCpeProfileDuration;
      delete postData.onDemandCpeProfileDurationUI;
    }

    if (!isNaN(postData.onDemandCpeErrors)) {
      postData.onDemandCpeErrors = toCents(
        postData.onDemandCpeErrors,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeTransactions)) {
      postData.onDemandCpeTransactions = toCents(
        postData.onDemandCpeTransactions,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeReplays)) {
      postData.onDemandCpeReplays = toCents(
        postData.onDemandCpeReplays,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeAttachments)) {
      postData.onDemandCpeAttachments = toCents(
        postData.onDemandCpeAttachments,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeMonitorSeats)) {
      postData.onDemandCpeMonitorSeats = toCents(
        postData.onDemandCpeMonitorSeats,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeUptime)) {
      postData.onDemandCpeUptime = toCents(
        postData.onDemandCpeUptime,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeSpans)) {
      postData.onDemandCpeSpans = toCents(
        postData.onDemandCpeSpans,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeSpansIndexed)) {
      postData.onDemandCpeSpansIndexed = toCents(
        postData.onDemandCpeSpansIndexed,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeProfileDuration)) {
      postData.onDemandCpeProfileDuration = toCents(
        postData.onDemandCpeProfileDuration,
        CPE_DECIMAL_PRECISION
      );
    }
    if (!isNaN(postData.onDemandCpeProfileDurationUI)) {
      postData.onDemandCpeProfileDuration = toCents(
        postData.onDemandCpeProfileDuration,
        CPE_DECIMAL_PRECISION
      );
    }

    if (!isNaN(postData.reservedCpeSpans)) {
      postData.reservedCpeSpans = toCpeCents(postData.reservedCpeSpans);
    }
    if (!isNaN(postData.reservedCpeSpansIndexed)) {
      postData.reservedCpeSpansIndexed = toCpeCents(postData.reservedCpeSpansIndexed);
    }

    postData.retainOnDemandBudget = postData.retainOnDemandBudget
      ? !this.disableRetainOnDemand()
      : false;

    const hasCustomPrice = hasCustomSkuPrices || postData.managed;
    if (!hasCustomPrice) {
      delete postData.hasCustomPrice;
    }

    if (!isNaN(postData.customPriceErrors)) {
      postData.customPriceErrors *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceTransactions)) {
      postData.customPriceTransactions *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceReplays)) {
      postData.customPriceReplays *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceSpans)) {
      postData.customPriceSpans *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceSpansIndexed)) {
      postData.customPriceSpansIndexed *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceMonitorSeats)) {
      postData.customPriceMonitorSeats *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceUptime)) {
      postData.customPriceUptime *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceAttachments)) {
      postData.customPriceAttachments *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPricePcss)) {
      postData.customPricePcss *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceProfileDuration)) {
      postData.customPriceProfileDuration *= 100; // Price should be in cents
    }
    if (!isNaN(postData.customPriceProfileDurationUI)) {
      postData.customPriceProfileDurationUI *= 100; // Price should be in cents
    }

    if (!isNaN(postData.customPrice)) {
      postData.customPrice *= 100; // Price should be in cents

      // For AM only: If customPrice is set, ensure that it is equal to sum of SKU prices
      if (
        hasCustomSkuPrices &&
        postData.customPrice !==
          postData.customPriceErrors +
            (isAm3Plan(postData.plan)
              ? (postData.customPriceSpans ?? 0)
              : (postData.customPriceTransactions ?? 0)) +
            (postData.customPriceReplays ?? 0) +
            (postData.customPriceMonitorSeats ?? 0) +
            (postData.customPriceUptime ?? 0) +
            postData.customPriceAttachments +
            postData.customPricePcss +
            (postData.customPriceProfileDuration ?? 0) +
            (postData.customPriceProfileDurationUI ?? 0) +
            (isAm3DsPlan(postData.plan) ? (postData.customPriceSpansIndexed ?? 0) : 0)
      ) {
        onSubmitError({
          responseJSON: {
            customPrice: ['Custom Price must be equal to sum of SKU prices'],
          },
        });
        return;
      }
    }

    if (isAmPlan(postData.plan)) {
      // Setting soft cap types to null if not `ON_DEMAND` or `TRUE_FORWARD` ensures soft cap type
      // is disabled if it was set but is not set with the new provisioning request.
      if (!postData.softCapTypeErrors) {
        postData.softCapTypeErrors = null;
      }
      if (!postData.softCapTypeReplays) {
        postData.softCapTypeReplays = null;
      }
      if (!postData.softCapTypeAttachments) {
        postData.softCapTypeAttachments = null;
      }
      if (!postData.softCapTypeMonitorSeats) {
        postData.softCapTypeMonitorSeats = null;
      }
      if (!postData.softCapTypeUptime) {
        postData.softCapTypeUptime = null;
      }
      if (!postData.softCapTypeProfileDuration) {
        postData.softCapTypeProfileDuration = null;
      }
      if (!postData.softCapTypeProfileDurationUI) {
        postData.softCapTypeProfileDuration = null;
      }
      // If a data category has a set soft cap type, trueForward will also need to be set to true for that category
      // until the true forward fields are fully deprecated and soft cap types are used in their place.
      postData.trueForward = {
        errors: postData.softCapTypeErrors ? true : false,
        replays: postData.softCapTypeReplays ? true : false,
        attachments: postData.softCapTypeAttachments ? true : false,
        monitor_seats: postData.softCapTypeMonitorSeats ? true : false,
        uptime: postData.softCapTypeUptime ? true : false,
        profile_duration: postData.softCapTypeProfileDuration ? true : false,
        profile_duration_ui: postData.softCapTypeProfileDurationUI ? true : false,
      };

      if (isAm3Plan(postData.plan)) {
        postData.trueForward = {
          ...postData.trueForward,
          spans: postData.softCapTypeSpans ? true : false,
        };
        delete postData.softCapTypeTransactions;
        if (!postData.softCapTypeSpans) {
          postData.softCapTypeSpans = null;
        }
      } else {
        postData.trueForward = {
          ...postData.trueForward,
          transactions: postData.softCapTypeTransactions ? true : false,
        };
        delete postData.softCapTypeSpans;
        delete postData.softCapTypeSpansIndexed;
        if (!postData.softCapTypeTransactions) {
          postData.softCapTypeTransactions = null;
        }
      }
    }

    if (isAm3DsPlan(postData.plan)) {
      postData.trueForward = {
        ...postData.trueForward,
        spansIndexed: postData.softCapTypeSpansIndexed ? true : false,
      };
      if (!postData.softCapTypeSpansIndexed) {
        postData.softCapTypeSpansIndexed = null;
      }
      if (this.hasCompleteSpansBudget()) {
        postData.reservedBudgets = [
          {
            categories: ['spans', 'spansIndexed'],
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
    } else {
      for (const k in postData) {
        if (k.endsWith('SpansIndexed')) {
          delete postData[k];
        }
      }
      delete postData.reservedCpeSpans;
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

  provisionablePlans = [
    ['am3_business_ent_ds', 'Business with Dynamic Sampling (am3)'],
    ['am3_team_ent_ds', 'Team with Dynamic Sampling (am3)'],
    ['am3_business_ent', 'Business (am3)'],
    ['am3_team_ent', 'Team (am3)'],
    ['am2_business_ent', 'Business (am2)'],
    ['am2_team_ent', 'Team (am2)'],
    ['am1_business_ent', 'Business (am1)'],
    ['am1_team_ent', 'Team (am1)'],
    ['mm2_a', 'Business (mm2)'],
    ['mm2_b', 'Team (mm2)'],
    ['e1', 'Enterprise (mm1)'],
  ];

  render() {
    const {Header, Body, closeModal, canProvisionDsPlan = false} = this.props;
    const {data} = this.state;

    const isAmEnt = isAmEnterprisePlan(data.plan);
    const isAm3 = isAm3Plan(data.plan);
    const isAm3Ds = isAm3DsPlan(data.plan);
    const hasCustomSkuPrices = isAmEnt;
    const hasCustomPrice = hasCustomSkuPrices || !!data.managed; // Refers to ACV

    if (!canProvisionDsPlan) {
      this.provisionablePlans = this.provisionablePlans.filter(
        plan => !isAm3DsPlan(plan[0])
      );
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
                  choices={this.provisionablePlans}
                  onChange={v => {
                    // Reset price fields if next plan is not AM Enterprise
                    const isManagedPlan = isAmEnterprisePlan(v as string);
                    const chosenPlanIsAm3Ds = isAm3DsPlan(v as string);
                    const nextPrices = isManagedPlan
                      ? {}
                      : {
                          customPriceErrors: '',
                          customPriceTransactions: '',
                          customPriceReplays: '',
                          customPriceMonitorSeats: '',
                          customPriceUptime: '',
                          customPriceSpans: '',
                          customPriceSpansIndexed: '',
                          customPriceAttachments: '',
                          customPricePcss: '',
                          customPrice: '',
                        };
                    const nextReservedCpes = chosenPlanIsAm3Ds
                      ? {}
                      : {
                          reservedCpeSpans: '',
                          reservedCpeSpansIndexed: '',
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
                    label="On-Demand Max Spend Type"
                    name="onDemandInvoicedManual"
                    choices={[
                      ['SHARED', 'Shared'],
                      ['PER_CATEGORY', 'Per Category'],
                      ['DISABLE', 'Disable'],
                    ]}
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
                <SectionHeader>Plan Quotas</SectionHeader>
                <SectionHeaderDescription>
                  Monthly quantities for each SKU
                </SectionHeaderDescription>

                <NumberField
                  label="Reserved Errors"
                  name="reservedErrors"
                  required={!!data.plan}
                  value={this.state.data.reservedErrors}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, reservedErrors: v},
                    }))
                  }
                />
                <SelectField
                  label="Soft Cap Type Errors"
                  name="softCapTypeErrors"
                  clearable
                  required={false}
                  choices={[
                    ['ON_DEMAND', 'On Demand'],
                    ['TRUE_FORWARD', 'True Forward'],
                  ]}
                  disabled={this.isEnablingOnDemandMaxSpend()}
                  value={this.state.data.softCapTypeErrors}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, softCapTypeErrors: v},
                    }))
                  }
                />

                <NumberField
                  label="Reserved Performance Units"
                  name="reservedTransactions"
                  required={isAmEnt}
                  disabled={!isAmEnt || isAm3}
                  value={this.state.data.reservedTransactions}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, reservedTransactions: v},
                    }))
                  }
                />
                <SelectField
                  label="Soft Cap Type Performance Units"
                  name="softCapTypeTransactions"
                  clearable
                  required={false}
                  choices={[
                    ['ON_DEMAND', 'On Demand'],
                    ['TRUE_FORWARD', 'True Forward'],
                  ]}
                  disabled={this.isEnablingOnDemandMaxSpend() || !isAmEnt || isAm3}
                  value={this.state.data.softCapTypeTransactions}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, softCapTypeTransactions: v},
                    }))
                  }
                />

                <NumberField
                  label="Reserved Replays"
                  name="reservedReplays"
                  required={isAmEnt}
                  disabled={!isAmEnt}
                  value={this.state.data.reservedReplays}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, reservedReplays: v},
                    }))
                  }
                />
                <SelectField
                  label="Soft Cap Type Replays"
                  name="softCapTypeReplays"
                  clearable
                  required={false}
                  choices={[
                    ['ON_DEMAND', 'On Demand'],
                    ['TRUE_FORWARD', 'True Forward'],
                  ]}
                  disabled={this.isEnablingOnDemandMaxSpend() || !isAmEnt}
                  value={this.state.data.softCapTypeReplays}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, softCapTypeReplays: v},
                    }))
                  }
                />

                <NumberField
                  label={`Reserved ${isAm3Ds ? 'Accepted Spans' : 'Spans'}`}
                  name="reservedSpans"
                  required={isAmEnt}
                  disabled={!isAm3 || this.state.data.reservedCpeSpans}
                  value={this.state.data.reservedSpans}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, reservedSpans: v},
                    }))
                  }
                />
                <SelectField
                  label={`Soft Cap Type ${isAm3Ds ? 'Accepted Spans' : 'Spans'}`}
                  name="softCapTypeSpans"
                  clearable
                  required={false}
                  choices={[
                    ['ON_DEMAND', 'On Demand'],
                    ['TRUE_FORWARD', 'True Forward'],
                  ]}
                  disabled={this.isEnablingOnDemandMaxSpend() || !isAm3}
                  value={this.state.data.softCapTypeSpans}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, softCapTypeSpans: v},
                    }))
                  }
                />
                {isAm3Ds && (
                  <StyledDollarsAndCentsField
                    label={`Reserved Cost-Per-${isAm3Ds ? 'Accepted Span' : 'Span'}`}
                    name="reservedCpeSpans"
                    disabled={!isAm3Ds}
                    value={data.reservedCpeSpans}
                    step={0.00000001}
                    min={0.00000001}
                    max={1}
                    onChange={v =>
                      this.setState(state => ({
                        ...state,
                        data: {
                          ...state.data,
                          reservedCpeSpans: v,
                          reservedSpans: RESERVED_BUDGET_QUOTA,
                        },
                      }))
                    }
                    onBlur={() => {
                      const currentValue = parseFloat(this.state.data.reservedCpeSpans);
                      if (!isNaN(currentValue)) {
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            reservedCpeSpans: currentValue.toFixed(CPE_DECIMAL_PRECISION),
                          },
                        }));
                      }
                    }}
                  />
                )}
                {isAm3Ds && (
                  <Fragment>
                    <NumberField
                      label="Reserved Stored Spans"
                      name="reservedSpansIndexed"
                      required={isAmEnt}
                      disabled={!isAm3Ds || this.state.data.reservedCpeSpansIndexed}
                      value={this.state.data.reservedSpansIndexed}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {...state.data, reservedSpansIndexed: v},
                        }))
                      }
                    />
                    <SelectField
                      label="Soft Cap Type Stored Spans"
                      name="softCapTypeSpansIndexed"
                      clearable
                      required={false}
                      choices={[
                        ['ON_DEMAND', 'On Demand'],
                        ['TRUE_FORWARD', 'True Forward'],
                      ]}
                      disabled={this.isEnablingOnDemandMaxSpend() || !isAm3Ds}
                      value={this.state.data.softCapTypeSpansIndexed}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {...state.data, softCapTypeSpansIndexed: v},
                        }))
                      }
                    />
                    <StyledDollarsAndCentsField
                      label="Reserved Cost-Per-Stored Span"
                      name="reservedCpeSpansIndexed"
                      disabled={!isAm3Ds}
                      value={data.reservedCpeSpansIndexed}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            reservedCpeSpansIndexed: v,
                            reservedSpansIndexed: RESERVED_BUDGET_QUOTA,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.reservedCpeSpansIndexed
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              reservedCpeSpansIndexed:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                  </Fragment>
                )}

                <NumberField
                  label="Reserved Monitor Seats"
                  name="reservedMonitorSeats"
                  required={isAmEnt}
                  disabled={!isAmEnt}
                  value={this.state.data.reservedMonitorSeats}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, reservedMonitorSeats: v},
                    }))
                  }
                />
                <SelectField
                  label="Soft Cap Type Monitor Seats"
                  name="softCapTypeMonitorSeats"
                  clearable
                  required={false}
                  choices={[
                    ['ON_DEMAND', 'On Demand'],
                    ['TRUE_FORWARD', 'True Forward'],
                  ]}
                  disabled={this.isEnablingOnDemandMaxSpend() || !isAmEnt}
                  value={this.state.data.softCapTypeMonitorSeats}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, softCapTypeMonitorSeats: v},
                    }))
                  }
                />

                <Fragment>
                  <NumberField
                    label="Reserved Uptime"
                    name="reservedUptime"
                    required={isAmEnt}
                    disabled={!isAmEnt}
                    value={this.state.data.reservedUptime}
                    onChange={v =>
                      this.setState(state => ({
                        ...state,
                        data: {...state.data, reservedUptime: v},
                      }))
                    }
                  />
                  <SelectField
                    label="Soft Cap Type Uptime"
                    name="softCapTypeUptime"
                    clearable
                    required={false}
                    choices={[
                      ['ON_DEMAND', 'On Demand'],
                      ['TRUE_FORWARD', 'True Forward'],
                    ]}
                    disabled={this.isEnablingOnDemandMaxSpend() || !isAmEnt}
                    value={this.state.data.softCapTypeUptime}
                    onChange={v =>
                      this.setState(state => ({
                        ...state,
                        data: {...state.data, softCapTypeUptime: v},
                      }))
                    }
                  />
                </Fragment>

                <NumberField
                  label="Reserved Attachments (in GB)"
                  name="reservedAttachments"
                  required={isAmEnt}
                  disabled={!isAmEnt}
                  value={this.state.data.reservedAttachments}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, reservedAttachments: v},
                    }))
                  }
                />
                <SelectField
                  label="Soft Cap Type Attachments"
                  name="softCapTypeAttachments"
                  clearable
                  required={false}
                  choices={[
                    ['ON_DEMAND', 'On Demand'],
                    ['TRUE_FORWARD', 'True Forward'],
                  ]}
                  disabled={this.isEnablingOnDemandMaxSpend() || !isAmEnt}
                  value={this.state.data.softCapTypeAttachments}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, softCapTypeAttachments: v},
                    }))
                  }
                />
                <NumberField
                  label="Reserved Profile Duration (in hours)"
                  name="reservedProfileDuration"
                  required={isAmEnt}
                  disabled={!isAmEnt || true} // TODO: remove this when profile duration is enabled
                  value={this.state.data.reservedProfileDuration}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, reservedProfileDuration: v},
                    }))
                  }
                />
                <SelectField
                  label="Soft Cap Type Profile Duration"
                  name="softCapTypeProfileDuration"
                  clearable
                  required={false}
                  choices={[
                    ['ON_DEMAND', 'On Demand'],
                    ['TRUE_FORWARD', 'True Forward'],
                  ]}
                  disabled={this.isEnablingOnDemandMaxSpend() || !isAmEnt || true} // TODO: remove this when profile duration is enabled
                  value={this.state.data.softCapTypeProfileDuration}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, softCapTypeProfileDuration: v},
                    }))
                  }
                />
                <NumberField
                  label="Reserved Profile Duration UI (in hours)"
                  name="reservedProfileDurationUI"
                  required={isAmEnt}
                  disabled={!isAmEnt || true} // TODO: remove this when profile duration is enabled
                  value={this.state.data.reservedProfileDurationUI}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, reservedProfileDurationUI: v},
                    }))
                  }
                />
                <SelectField
                  label="Soft Cap Type Profile Duration UI"
                  name="softCapTypeProfileDurationUI"
                  clearable
                  required={false}
                  choices={[
                    ['ON_DEMAND', 'On Demand'],
                    ['TRUE_FORWARD', 'True Forward'],
                  ]}
                  disabled={this.isEnablingOnDemandMaxSpend() || !isAmEnt || true} // TODO: remove this when profile duration is enabled
                  value={this.state.data.softCapTypeProfileDurationUI}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {...state.data, softCapTypeProfileDurationUI: v},
                    }))
                  }
                />
              </div>
              <div>
                <SectionHeader>Reserved Volume Prices</SectionHeader>
                <SectionHeaderDescription>
                  Annual prices for reserved volumes, in whole dollars.
                </SectionHeaderDescription>

                <StyledDollarsField
                  label="Price for Errors"
                  name="customPriceErrors"
                  disabled={!hasCustomSkuPrices}
                  required={hasCustomSkuPrices}
                  value={data.customPriceErrors}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceErrors: v,
                      },
                    }))
                  }
                />
                <StyledDollarsField
                  label="Price for Performance Units"
                  name="customPriceTransactions"
                  disabled={!hasCustomSkuPrices || isAm3}
                  required={hasCustomSkuPrices}
                  value={data.customPriceTransactions}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceTransactions: v,
                      },
                    }))
                  }
                />

                <StyledDollarsField
                  label="Price for Replays"
                  name="customPriceReplays"
                  disabled={!hasCustomSkuPrices}
                  required={hasCustomSkuPrices}
                  value={data.customPriceReplays}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceReplays: v,
                      },
                    }))
                  }
                />

                <StyledDollarsField
                  label={`Price for ${isAm3Ds ? 'Accepted Spans' : 'Spans'}${this.isSettingSpansBudget() ? ' (Reserved Spans Budget)' : ''}`}
                  name="customPriceSpans"
                  disabled={!hasCustomSkuPrices || !isAm3}
                  required={hasCustomSkuPrices}
                  value={data.customPriceSpans}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceSpans: v,
                      },
                    }))
                  }
                />
                {isAm3Ds && (
                  <StyledDollarsField
                    label={`Price for Stored Spans`}
                    name="customPriceSpansIndexed"
                    disabled={
                      !hasCustomSkuPrices || !isAm3Ds || this.isSettingSpansBudget()
                    }
                    required={hasCustomSkuPrices}
                    value={this.isSettingSpansBudget() ? 0 : data.customPriceSpansIndexed}
                    onChange={v =>
                      this.setState(state => ({
                        ...state,
                        data: {
                          ...state.data,
                          customPriceSpansIndexed: v,
                        },
                      }))
                    }
                  />
                )}

                <StyledDollarsField
                  label="Price for Monitor Seats"
                  name="customPriceMonitorSeats"
                  disabled={!hasCustomSkuPrices}
                  required={hasCustomSkuPrices}
                  value={data.customPriceMonitorSeats}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceMonitorSeats: v,
                      },
                    }))
                  }
                />

                <StyledDollarsField
                  label="Price for Uptime"
                  name="customPriceUptime"
                  disabled={!hasCustomSkuPrices}
                  required={hasCustomSkuPrices}
                  value={data.customPriceUptime}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceUptime: v,
                      },
                    }))
                  }
                />

                <StyledDollarsField
                  label="Price for Attachments"
                  name="customPriceAttachments"
                  disabled={!hasCustomSkuPrices}
                  required={hasCustomSkuPrices}
                  value={data.customPriceAttachments}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceAttachments: v,
                      },
                    }))
                  }
                />
                <StyledDollarsField
                  label="Price for Profile Duration"
                  name="customPriceProfileDuration"
                  disabled={!hasCustomSkuPrices || true} // TODO: remove this when profile duration is enabled
                  required={hasCustomSkuPrices}
                  value={data.customPriceProfileDuration}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceProfileDuration: v,
                      },
                    }))
                  }
                />
                <StyledDollarsField
                  label="Price for Profile Duration UI"
                  name="customPriceProfileDurationUI"
                  disabled={!hasCustomSkuPrices || true} // TODO: remove this when profile duration is enabled
                  required={hasCustomSkuPrices}
                  value={data.customPriceProfileDurationUI}
                  onChange={v =>
                    this.setState(state => ({
                      ...state,
                      data: {
                        ...state.data,
                        customPriceProfileDurationUI: v,
                      },
                    }))
                  }
                />
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
                {this.isEnablingOnDemandMaxSpend() && (
                  <Fragment>
                    <SectionHeader>On-Demand Cost-Per-Event (CPE)</SectionHeader>
                    <SectionHeaderDescription>
                      The cost of on-demand units, in dollars, for invoiced customers with
                      on-demand max spend. If not set, the on-demand spend will be
                      calculated with the self-serve on-demand pricing.
                    </SectionHeaderDescription>
                    <Alert.Container>
                      <Alert type="warning">
                        If the subscription already has on-demand spend in the current
                        period, and the new cost-per-event overrides would cause the spend
                        to exceed the on-demand budget, the request will fail.
                      </Alert>
                    </Alert.Container>
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Error"
                      name="onDemandCpeErrors"
                      disabled={!this.isEnablingOnDemandMaxSpend()}
                      value={data.onDemandCpeErrors}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeErrors: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.onDemandCpeErrors
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeErrors:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Performance Unit"
                      name="onDemandCpeTransactions"
                      disabled={!this.isEnablingOnDemandMaxSpend() || isAm3}
                      value={data.onDemandCpeTransactions}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeTransactions: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.onDemandCpeTransactions
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeTransactions:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Replay"
                      name="onDemandCpeReplays"
                      disabled={!this.isEnablingOnDemandMaxSpend()}
                      value={data.onDemandCpeReplays}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeReplays: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.onDemandCpeReplays
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeReplays:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Span"
                      name="onDemandCpeSpans"
                      disabled={!this.isEnablingOnDemandMaxSpend() || !isAm3}
                      value={data.onDemandCpeSpans}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeSpans: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(this.state.data.onDemandCpeSpans);
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeSpans:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Attachment"
                      name="onDemandCpeAttachments"
                      disabled={!this.isEnablingOnDemandMaxSpend()}
                      value={data.onDemandCpeAttachments}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeAttachments: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.onDemandCpeAttachments
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeAttachments:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Profile Duration"
                      name="onDemandCpeProfileDuration"
                      disabled={!this.isEnablingOnDemandMaxSpend() || true} // TODO: remove this when profile duration is enabled
                      value={data.onDemandCpeProfileDuration}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeProfileDuration: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.onDemandCpeProfileDuration
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeProfileDuration:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Profile Duration UI"
                      name="onDemandCpeProfileDurationUI"
                      disabled={!this.isEnablingOnDemandMaxSpend() || true} // TODO: remove this when profile duration is enabled
                      value={data.onDemandCpeProfileDurationUI}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeProfileDurationUI: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.onDemandCpeProfileDurationUI
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeProfileDurationUI:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Cron Monitor"
                      name="onDemandCpeMonitorSeats"
                      disabled={!this.isEnablingOnDemandMaxSpend()}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      value={data.onDemandCpeMonitorSeats}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeMonitorSeats: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.onDemandCpeMonitorSeats
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeMonitorSeats:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                    <StyledDollarsAndCentsField
                      label="On-Demand Cost-Per-Uptime Monitor"
                      name="onDemandCpeUptime"
                      disabled={!this.isEnablingOnDemandMaxSpend()}
                      step={0.00000001}
                      min={0.00000001}
                      max={1}
                      value={data.onDemandCpeUptime}
                      onChange={v =>
                        this.setState(state => ({
                          ...state,
                          data: {
                            ...state.data,
                            onDemandCpeUptime: v,
                          },
                        }))
                      }
                      onBlur={() => {
                        const currentValue = parseFloat(
                          this.state.data.onDemandCpeUptime
                        );
                        if (!isNaN(currentValue)) {
                          this.setState(state => ({
                            ...state,
                            data: {
                              ...state.data,
                              onDemandCpeUptime:
                                currentValue.toFixed(CPE_DECIMAL_PRECISION),
                            },
                          }));
                        }
                      }}
                    />
                  </Fragment>
                )}
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
