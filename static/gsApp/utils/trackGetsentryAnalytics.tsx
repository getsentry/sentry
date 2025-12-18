import type {FieldValue} from 'sentry/components/forms/model';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import makeAnalyticsFunction from 'sentry/utils/analytics/makeAnalyticsFunction';

import type {EventType} from 'getsentry/components/addEventsCTA';
import type {AddOnCategory, CheckoutType, Subscription} from 'getsentry/types';

type HasSub = {subscription: Subscription};
type QuotaAlert = {event_types: string; is_warning: boolean; source?: string} & HasSub;
type UpsellProvider = {
  action: string;
  can_trial: boolean;
  has_billing_scope: boolean;
  showed_confirmation: boolean;
  source: string;
} & HasSub;
type Checkout = {plan: string; checkoutType?: CheckoutType} & HasSub;
type BusinessLanding = HasSub & {source?: string};
type AddEventCTA = HasSub & {
  action: string;
  source: string;
  event_types?: string;
};
type BillingInfoUpdateEvent = {
  isStripeComponent: boolean;
  referrer?: string;
};
type ManualPaymentEvent = BillingInfoUpdateEvent;

type OnDemandBudgetStrategy = 'per_category' | 'shared';

type OnDemandCategory = `${EventType}_budget` | `previous_${EventType}_budget`; // for whatever reason, we used singular category names historically :( so we use EventType to retain that

type OnDemandBudgetUpdate = Partial<Record<OnDemandCategory, number>> & {
  previous_strategy: OnDemandBudgetStrategy;
  previous_total_budget: number;
  strategy: OnDemandBudgetStrategy;
  total_budget: number;
};

export type ProductUnavailableUpsellAlert = {
  action: 'update_plan' | 'manage_subscription' | 'request_update';
  has_performance: boolean;
  has_session_replay: boolean;
};

type GetsentryEventParameters = {
  'add_event_cta.clicked_cta': AddEventCTA;
  'am_checkout.viewed': HasSub;
  'billing_details.updated_billing_details': BillingInfoUpdateEvent;
  'billing_details.updated_cc': BillingInfoUpdateEvent;
  'billing_failure.button_clicked': {
    has_link?: boolean;
    has_permissions?: boolean;
    referrer?: string;
  };
  'billing_failure.displayed_banner': {
    has_permissions?: boolean;
    referrer?: string;
  };
  'billing_failure.paid_now': ManualPaymentEvent;
  'billing_failure.updated_cc': BillingInfoUpdateEvent;
  'business_landing.clicked': BusinessLanding & {type: string};
  'business_landing.clicked_compare': BusinessLanding;
  'business_landing.clicked_maybe_later': BusinessLanding & {closing_feature: string};
  'business_landing.closed': BusinessLanding & {closing_feature: string};
  'business_landing.viewed': BusinessLanding & {
    initial_feature: string;
    has_permissions?: boolean;
  };
  'checkout.bundle_navigation': {
    action: 'new' | 'skipped' | 'returned';
    step_number: number;
  } & HasSub;
  'checkout.change_contract': Checkout;
  'checkout.change_plan': Checkout;
  'checkout.click_continue': {step_number: number; step_id?: string} & Checkout;
  'checkout.data_slider_changed': {data_type: string; quantity: number};
  // no sub here;
  'checkout.data_sliders_viewed': Record<PropertyKey, unknown>;
  'checkout.exit': HasSub;
  'checkout.ondemand_budget.turned_off': Record<PropertyKey, unknown>;
  'checkout.ondemand_budget.update': OnDemandBudgetUpdate;
  'checkout.ondemand_changed': {cents: number} & Checkout;
  'checkout.payg_changed': {cents: number; method?: 'button' | 'textbox'} & Checkout;
  'checkout.product_select': Partial<
    Record<
      AddOnCategory,
      {
        enabled: boolean;
        previously_enabled: boolean;
      }
    >
  > &
    HasSub;
  'checkout.transactions_upgrade': {
    previous_transactions: number;
    transactions: number;
  } & Checkout;
  'checkout.updated_billing_details': BillingInfoUpdateEvent;
  'checkout.updated_cc': BillingInfoUpdateEvent;
  // no sub here
  'checkout.upgrade': {
    previous_plan: string;
    categories?: Partial<
      Record<
        DataCategory,
        {
          previous_reserved: number | undefined;
          reserved: number | undefined;
        }
      >
    >;
  } & Partial<Record<DataCategory | `previous_${DataCategory}`, number | undefined>> &
    Checkout;
  'data_consent_modal.learn_more': Record<PropertyKey, unknown>;
  'data_consent_priority.viewed': Record<PropertyKey, unknown>;
  'data_consent_settings.updated': {setting: string; value: FieldValue};
  'deactivated_member_alert.snoozed': HasSub;
  'deactivated_member_alert.upgrade_link_clicked': HasSub;
  'disabled_member_view.clicked_leave_org': HasSub;
  'disabled_member_view.clicked_upgrade_request': HasSub;
  'disabled_member_view.loaded': HasSub;
  'gen_ai_consent.in_drawer_clicked': Record<PropertyKey, unknown>;
  'gen_ai_consent.settings_clicked': {
    value: FieldValue;
  };
  'gen_ai_consent.view_in_settings_clicked': Record<PropertyKey, unknown>;
  'github.multi_org.upsell': {source?: string};
  'grace_period_modal.seen': HasSub;
  'growth.clicked_enter_sandbox': {
    scenario: string;
  };
  'growth.codecov_promotion_accept': HasSub;
  'growth.codecov_promotion_decline': HasSub;
  'growth.codecov_promotion_opened': HasSub;
  'growth.disabled_dashboard.viewed': Record<PropertyKey, unknown>;
  'growth.issue_open_in_discover_upsell_clicked': Record<PropertyKey, unknown>;
  'growth.metric_alert_banner.clicked': HasSub;
  'growth.metric_alert_banner.dismissed': HasSub;
  'growth.onboarding_clicked_need_help': {
    source?: string;
  };
  'growth.onboarding_clicked_upgrade': {
    source?: string;
  };
  'growth.promo_modal_accept': {promo: string};
  'growth.promo_modal_decline': {promo: string};
  'growth.promo_reminder_modal_continue_downgrade': {promo: string};
  'growth.promo_reminder_modal_keep': {promo: string};
  'growth.upgrade_or_trial.clicked': {
    action: string;
    source: string;
  } & HasSub;
  'growth.upsell_feature.cancelled': UpsellProvider;
  'growth.upsell_feature.clicked': UpsellProvider;
  'growth.upsell_feature.confirmed': UpsellProvider;
  'learn_more_link.clicked': {source?: string};
  'ondemand_budget_modal.ondemand_budget.turned_off': Record<PropertyKey, unknown>;
  'ondemand_budget_modal.ondemand_budget.update': OnDemandBudgetUpdate;
  'partner_billing_migration.banner.clicked_cta': {
    daysLeft: number;
    partner: undefined | string;
  } & HasSub;
  'partner_billing_migration.checkout.completed': {
    applyNow: boolean;
    daysLeft: number;
    partner: undefined | string;
  } & HasSub;
  'partner_billing_migration.modal.clicked_cta': {
    daysLeft: number;
    partner: undefined | string;
  } & HasSub;
  'past_due_modal.seen': HasSub;
  'payg_inline_form.ondemand_budget.turned_off': Record<PropertyKey, unknown>;
  'payg_inline_form.ondemand_budget.update': OnDemandBudgetUpdate;
  'performance.quota_exceeded_alert.displayed': {
    referrer: string;
    traceItemDataset: string;
  };
  'power_icon.clicked': {
    source?: string;
  } & HasSub;
  'product_trial.clicked_snooze': QuotaAlert;
  'product_unavailable_upsell_alert.viewed': ProductUnavailableUpsellAlert;
  'product_unavailable_upsell_alert_button.clicked': ProductUnavailableUpsellAlert;
  'quota_alert.alert_displayed': QuotaAlert;
  'quota_alert.clicked_link': QuotaAlert & {clicked_event: EventType};
  'quota_alert.clicked_see_usage': QuotaAlert;
  'quota_alert.clicked_snooze': QuotaAlert;
  'quota_alert.clicked_unsnooze': QuotaAlert;
  'quota_alert.shown': QuotaAlert;
  'replay.list_page.manage_sub': UpdateProps;
  'replay.list_page.open_modal': UpdateProps & {
    has_price_change: undefined | boolean;
  };
  'replay.list_page.sent_email': UpdateProps;
  'replay.list_page.viewed': UpdateProps;
  'sales.contact_us_clicked': {
    source: string;
  } & HasSub;
  'seer.onboarding.code_review_updated': {
    added_repositories: number;
    removed_repositories: number;
  };
  'seer.onboarding.defaults_updated': {
    auto_create_pr: boolean;
    enable_code_review: boolean;
    enable_root_cause_analysis: boolean;
  };
  'seer.onboarding.root_cause_analysis_updated': {
    auto_create_pr: boolean;
    projects_mapped: number;
  };
  'seer.onboarding.started': {stepNumber: number};
  'seer.onboarding.step_changed': {stepNumber: number};
  'spend_allocations.open_form': {create_or_edit: string} & HasSub;
  'spend_allocations.submit': {create_or_edit: string} & HasSub;
  'subscription_page.display_mode.changed': {
    display_mode: 'usage' | 'cost';
  } & HasSub;
  'subscription_page.download_reports.clicked': {
    reportType: 'summary' | 'project_breakdown';
  };
  'subscription_page.usage_overview.add_on_toggled': {
    addOnCategory: AddOnCategory;
    isOpen: boolean;
  } & HasSub;
  'subscription_page.usage_overview.row_clicked': (
    | {
        dataCategory: DataCategory;
      }
    | {addOnCategory: AddOnCategory}
  ) &
    HasSub;
  'subscription_page.usage_overview.transform_changed': {
    transform: string;
  } & HasSub;
  'subscription_page.usagelog_filter.clicked': {selection: string};
  'trial_ended_notice.dismissed_understood': HasSub;
  'trial_reset_notification.modal_dismissed': HasSub;
  'upgrade_now.alert.dismiss': UpdateProps;
  'upgrade_now.alert.manage_sub': UpdateProps;
  'upgrade_now.alert.open_modal': UpdateProps;
  'upgrade_now.alert.viewed': UpdateProps;
  'upgrade_now.modal.manage_sub': UpdateProps;
  'upgrade_now.modal.sent_email': UpdateProps;
  'upgrade_now.modal.update_now': UpdateProps & {
    has_price_change: undefined | boolean;
  };
  'upgrade_now.modal.viewed': UpdateProps & {
    has_price_change: undefined | boolean;
  };
  'usage_exceeded_modal.seen': HasSub;
  'zendesk_link.clicked': {source?: string};
  'zendesk_link.viewed': {source?: string};
};

export type AM2UpdateSurfaces =
  | 'metrics'
  | 'profiling'
  | 'replay_onboarding_banner'
  | 'replay_project_creation'
  | 'replay'
  | 'subscription_page';
type UpdateProps = Pick<Subscription, 'planTier' | 'canSelfServe' | 'channel'> & {
  has_billing_scope: boolean;
  surface: AM2UpdateSurfaces;
};

export type GetsentryEventKey = keyof GetsentryEventParameters;

export const GETSENTRY_EVENT_MAP: Record<GetsentryEventKey, string> = {
  'power_icon.clicked': 'Clicked Power Icon',
  'github.multi_org.upsell': 'Github Multi-Org Upsell Clicked',
  'growth.clicked_enter_sandbox': 'Growth: Clicked Enter Sandbox',
  'growth.onboarding_clicked_need_help': 'Growth: Onboarding Clicked Need Help',
  'growth.onboarding_clicked_upgrade': 'Growth: Onboarding Clicked Upgrade',
  'growth.upgrade_or_trial.clicked': 'Growth: Upgrade or Trial Clicked',
  'growth.upsell_feature.confirmed': 'Growth: Upsell Feature Modal Confirmed',
  'growth.upsell_feature.cancelled': 'Growth: Upsell Feature Modal Cancelled',
  'growth.upsell_feature.clicked': 'Growth: Upsell Feature Clicked',
  'growth.issue_open_in_discover_upsell_clicked':
    'Growth: Open in Discover Upsell in Issue Details clicked',
  'growth.metric_alert_banner.clicked': 'Growth: Clicked Metric Alert Banner',
  'growth.metric_alert_banner.dismissed': 'Growth: Dismissed Metric Alert Banner',
  'growth.promo_modal_accept': 'Growth: Promo Modal Accept',
  'growth.promo_modal_decline': 'Growth: Promo Modal Decline',
  'growth.promo_reminder_modal_keep': 'Growth: Promo Reminder Modal Keep',
  'growth.promo_reminder_modal_continue_downgrade':
    'Growth: Promo Reminder Modal Continue Downgrade',
  'growth.codecov_promotion_accept': 'Growth: Codecov Promotion Accept',
  'growth.codecov_promotion_decline': 'Growth: Codecov Promotion Decline',
  'growth.codecov_promotion_opened': 'Growth: Codecov Promotion Opened',
  'quota_alert.shown': 'Quota Alert: Shown',
  'quota_alert.clicked_snooze': 'Quota Alert: Clicked Snooze',
  'quota_alert.clicked_unsnooze': 'Quota Alert: Clicked Unsnooze',
  'product_trial.clicked_snooze': 'Quota Alert: Clicked Snooze',
  'quota_alert.clicked_link': 'Quota Alert: Clicked Link',
  'quota_alert.clicked_see_usage': 'Quota Alert: Clicked See Usage',
  'quota_alert.alert_displayed': 'Quota Alert: Alert Displayed',
  'performance.quota_exceeded_alert.displayed':
    'Performance: Quota Exceeded Alert Displayed',
  'trial_ended_notice.dismissed_understood': 'Trial Ended Notice: Dismissed understood',
  'grace_period_modal.seen': 'Grace Period Modal Seen',
  'usage_exceeded_modal.seen': 'Usage Exceeded Modal Seen',
  'past_due_modal.seen': 'Past Due Modal Seen',
  'deactivated_member_alert.snoozed': 'Deactivated Member Alert: Snoozed',
  'deactivated_member_alert.upgrade_link_clicked':
    'Deactivated Member Alert: Upgrade Link Clicked',
  'business_landing.clicked_maybe_later': 'Clicked Maybe Later on Business Landing',
  'business_landing.clicked_compare': 'Clicked Compare Plans on Business Landing',
  'business_landing.clicked': 'Clicked Business Landing',
  'business_landing.viewed': 'Viewed Business Landing',
  'business_landing.closed': 'Closed Business Landing',
  'am_checkout.viewed': 'AM Checkout: Viewed',
  'checkout.bundle_navigation': 'Checkout: Bundle Navigation',
  'checkout.change_plan': 'Checkout: Change Plan',
  'checkout.product_select': 'Checkout: Product Select',
  'checkout.ondemand_changed': 'Checkout: Ondemand Changed',
  'checkout.payg_changed': 'Checkout: Pay As You Go Budget Changed',
  'checkout.change_contract': 'Checkout: Change Contract',
  'checkout.click_continue': 'Checkout: Click Continue',
  'checkout.data_slider_changed': 'Checkout: Data Slider Changed',
  'checkout.data_sliders_viewed': 'Checkout: Data Slider Viewed',
  'checkout.exit': 'Checkout: Back to Subscription Overview',
  'checkout.upgrade': 'Application: Upgrade',
  'checkout.updated_cc': 'Checkout: Updated CC',
  'checkout.updated_billing_details': 'Checkout: Updated billing details',
  'checkout.transactions_upgrade': 'Application: Transactions Upgrade',
  'billing_details.updated_cc': 'Billing Details: Updated CC',
  'billing_details.updated_billing_details': 'Billing Details: Updated billing details',
  'billing_failure.displayed_banner': 'Billing Failure: Displayed Banner',
  'billing_failure.button_clicked': 'Billing Failure: Button Clicked',
  'billing_failure.paid_now': 'Billing Failure: Paid Now',
  'billing_failure.updated_cc': 'Billing Failure: Updated CC',
  'add_event_cta.clicked_cta': 'Add Event CTA: Clicked CTA',
  'subscription_page.usagelog_filter.clicked': 'Usage Log Filter: Clicked',
  'subscription_page.download_reports.clicked':
    'Subscription Page: Download Reports Clicked',
  'sales.contact_us_clicked': 'Clicked Contact Sales',
  'disabled_member_view.loaded': 'Disabled Member View: Loaded',
  'disabled_member_view.clicked_upgrade_request':
    'Disabled Member View: Clicked Upgrade Request',
  'disabled_member_view.clicked_leave_org': 'Disabled Member View: Clicked Leave Org',
  'ondemand_budget_modal.ondemand_budget.turned_off': 'Disabled PAYG Budget',
  'ondemand_budget_modal.ondemand_budget.update': 'Update PAYG Budget',
  'payg_inline_form.ondemand_budget.turned_off':
    'PAYG In-line Form: Disabled PAYG Budget',
  'payg_inline_form.ondemand_budget.update': 'PAYG In-line Form: Update PAYG Budget',
  'checkout.ondemand_budget.turned_off': 'Checkout: Disabled PAYG Budget',
  'checkout.ondemand_budget.update': 'Checkout: Update PAYG Budget',
  'trial_reset_notification.modal_dismissed': 'Trial Reset Notification: Modal Dismissed',
  'growth.disabled_dashboard.viewed': 'Growth: Disabled Dashboard Viewed',
  'product_unavailable_upsell_alert.viewed': 'Product Unavailable Upsell: Viewed Alert',
  'product_unavailable_upsell_alert_button.clicked':
    'Product Unavailable Upsell: Clicked Alert Button',
  'replay.list_page.manage_sub':
    'Replay E2E Checkout: Clicked Managed Subscription from List Page',
  'replay.list_page.open_modal': 'Replay E2E Checkout: Opened Modal from List Page',
  'replay.list_page.sent_email': 'Replay E2E Checkout: Sent Email from List Page',
  'replay.list_page.viewed': 'Replay E2E Checkout: Viewed List Page',
  'seer.onboarding.started': 'Seer Onboarding: Started',
  'seer.onboarding.step_changed': 'Seer Onboarding: Step Changed',
  'seer.onboarding.code_review_updated': 'Seer Onboarding: Code Review Updated',
  'seer.onboarding.root_cause_analysis_updated':
    'Seer Onboarding: Root Cause Analysis Updated',
  'seer.onboarding.defaults_updated': 'Seer Onboarding: Defaults Updated',
  'upgrade_now.alert.dismiss': 'Upgrade Now Alert: Dismissed',
  'upgrade_now.alert.manage_sub': 'Upgrade Now Alert: Clicked Managed Subscription',
  'upgrade_now.alert.open_modal': 'Upgrade Now Alert: Opened Modal',
  'upgrade_now.alert.viewed': 'Upgrade Now Alert: Viewed Alert',
  'upgrade_now.modal.manage_sub': 'Upgrade Now Modal: Viewed Checkout',
  'upgrade_now.modal.sent_email': 'Upgrade Now Modal: Sent Email',
  'upgrade_now.modal.update_now': 'Upgrade Now Modal: Clicked Update Now',
  'upgrade_now.modal.viewed': 'Upgrade Now Modal: Viewed Modal',
  'zendesk_link.viewed': 'Zendesk Link Viewed',
  'zendesk_link.clicked': 'Zendesk Link Clicked',
  'learn_more_link.clicked': 'Learn More Link Clicked',
  'spend_allocations.open_form': 'Spend Allocations: Form Opened',
  'spend_allocations.submit': 'Spend Allocations: Form Submitted',
  'data_consent_modal.learn_more': 'Data Consent Modal: Learn More',
  'data_consent_settings.updated': 'Data Consent Settings: Updated',
  'data_consent_priority.viewed': 'Data Consent Priority: Viewed',
  'partner_billing_migration.banner.clicked_cta':
    'Partner Billing Migration: Clicked Plan Ending Banner CTA',
  'partner_billing_migration.checkout.completed':
    'Partner Billing Migration: Migration Completed',
  'partner_billing_migration.modal.clicked_cta':
    'Partner Billing Migration: Clicked Plan Ending Modal CTA',
  'gen_ai_consent.settings_clicked': 'Gen AI Consent: Settings Toggle Clicked',
  'gen_ai_consent.in_drawer_clicked': 'Gen AI Consent: Clicked In Drawer',
  'gen_ai_consent.view_in_settings_clicked': 'Gen AI Consent: View in Settings Clicked',
  'subscription_page.display_mode.changed': 'Subscription Page: Display Mode Changed',
  'subscription_page.usage_overview.row_clicked':
    'Subscription Page: Usage Overview Row Clicked',
  'subscription_page.usage_overview.transform_changed':
    'Subscription Page: Usage Overview Transform Changed',
  'subscription_page.usage_overview.add_on_toggled':
    'Subscription Page: Usage Overview Add On Toggled',
};

const trackGetsentryAnalytics = makeAnalyticsFunction<
  GetsentryEventParameters,
  {organization: Organization}
>(GETSENTRY_EVENT_MAP);

export default trackGetsentryAnalytics;
