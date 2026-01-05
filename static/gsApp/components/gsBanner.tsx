import React, {Component, Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import * as Sentry from '@sentry/react';
import Cookies from 'js-cookie';
import snakeCase from 'lodash/snakeCase';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import type {PromptData} from 'sentry/actionCreators/prompts';
import {
  batchedPromptsCheck,
  promptsCheck,
  promptsUpdate,
} from 'sentry/actionCreators/prompts';
import type {Client} from 'sentry/api';
import {Alert, type AlertProps} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import {useInvertedTheme} from 'sentry/utils/theme/useInvertedTheme';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import withApi from 'sentry/utils/withApi';

import {
  openForcedTrialModal,
  openPartnerPlanEndingModal,
  openTrialEndingModal,
} from 'getsentry/actionCreators/modal';
import type {EventType} from 'getsentry/components/addEventsCTA';
import AddEventsCTA from 'getsentry/components/addEventsCTA';
import ProductTrialAlert from 'getsentry/components/productTrial/productTrialAlert';
import {getProductForPath} from 'getsentry/components/productTrial/productTrialPaths';
import {makeLinkToOwnersAndBillingMembers} from 'getsentry/components/profiling/alerts';
import withSubscription from 'getsentry/components/withSubscription';
import ZendeskLink from 'getsentry/components/zendeskLink';
import {BILLED_DATA_CATEGORY_INFO} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {
  type BilledDataCategoryInfo,
  type Promotion,
  type PromotionClaimed,
  type Subscription,
} from 'getsentry/types';
import {
  getContractDaysLeft,
  getProductTrial,
  getTrialLength,
  hasPartnerMigrationFeature,
  hasPerformance,
  isBusinessTrial,
  partnerPlanEndingModalIsDismissed,
  trialPromptIsDismissed,
} from 'getsentry/utils/billing';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';
import {getPendoAccountFields} from 'getsentry/utils/pendo';
import {claimAvailablePromotion} from 'getsentry/utils/promotionUtils';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import trackMarketingEvent from 'getsentry/utils/trackMarketingEvent';
import withPromotions from 'getsentry/utils/withPromotions';

enum ModalType {
  USAGE_EXCEEDED = 'usage-exceeded',
  GRACE_PERIOD = 'grace-period',
  PAST_DUE = 'past-due',
  MEMBER_LIMIT = 'member-limit',
}

/**
 * how many days before the trial ends should we show the trial ending modal?
 */
const TRIAL_ENDING_DAY_WINDOW = 3;

function objectFromBilledCategories(callback: (c: BilledDataCategoryInfo) => any) {
  return Object.values(BILLED_DATA_CATEGORY_INFO).reduce(
    (acc, c) => {
      if (c.isBilledCategory) {
        acc[c.singular as EventType] = callback(c);
      }
      return acc;
    },
    {} as Record<EventType, any>
  );
}

const ALERTS_OFF: Record<EventType, boolean> = objectFromBilledCategories(() => false);

type SuspensionModalProps = ModalRenderProps & {
  subscription: Subscription;
};

function SuspensionModal({Header, Body, Footer, subscription}: SuspensionModalProps) {
  return (
    <Fragment>
      <Header>{'Action Required'}</Header>
      <Body>
        <Alert.Container>
          <Alert variant="warning">{t('Your account has been suspended')}</Alert>
        </Alert.Container>
        <p>{t('Your account has been suspended with the following reason:')}</p>
        <ul>
          <li>
            <strong>{subscription.suspensionReason}</strong>
          </li>
        </ul>
        <p>
          {t(
            'Until this situation is resolved you will not be able to send events to Sentry. Please contact support if you have any questions or need assistance.'
          )}
        </p>
      </Body>
      <Footer>
        <ZendeskLink
          subject="Account Suspension"
          Component={props => <LinkButton {...props} href={props.href ?? ''} />}
          source="account-suspension"
        >
          {t('Contact Support')}
        </ZendeskLink>
      </Footer>
    </Fragment>
  );
}

type NoticeModalProps = ModalRenderProps & {
  billingPermissions: boolean;
  organization: Organization;
  subscription: Subscription;
  whichModal: ModalType;
};

function NoticeModal({
  Header,
  Body,
  Footer,
  closeModal,
  subscription,
  organization,
  whichModal,
  billingPermissions,
}: NoticeModalProps) {
  const navigate = useNavigate();
  const closeModalAndContinue = (link: string) => {
    closeModal();
    if (whichModal === ModalType.PAST_DUE) {
      trackGetsentryAnalytics('billing_failure.button_clicked', {
        organization,
        has_link: true,
        has_permissions: billingPermissions,
        referrer: 'modal-billing-failure',
      });
    }
    if (link === window.location.pathname) {
      return;
    }
    navigate(link);
  };

  const closeModalDoNotContinue = () => {
    closeModal();
    if (whichModal === ModalType.PAST_DUE) {
      trackGetsentryAnalytics('billing_failure.button_clicked', {
        organization,
        has_link: false,
        has_permissions: billingPermissions,
        referrer: 'modal-billing-failure',
      });
    }
  };

  const alertType = whichModal === ModalType.PAST_DUE ? 'danger' : 'warning';

  let subText: React.ReactNode;
  let body: React.ReactNode;
  let title: React.ReactNode;
  let link: string;
  let primaryButtonMessage: React.ReactNode;

  switch (whichModal) {
    case ModalType.GRACE_PERIOD:
      title = t('Grace period started');
      body = tct(
        `Your organization has depleted its error capacity for the current usage period.
          We've put your account into a one time grace period, which will continue to accept errors at a limited rate.
          This grace period ends on [gracePeriodEnd].`,
        {gracePeriodEnd: moment(subscription.gracePeriodEnd).format('ll')}
      );
      link = normalizeUrl(`/settings/${organization.slug}/billing/overview/`);
      primaryButtonMessage = t('Continue');
      break;
    case ModalType.USAGE_EXCEEDED:
      title = t('Usage exceeded');
      body = t(
        `Your organization has depleted its event capacity for the current usage period and is currently not receiving new events.`
      );
      link = normalizeUrl(`/settings/${organization.slug}/billing/overview/`);
      primaryButtonMessage = t('Continue');
      break;
    case ModalType.PAST_DUE:
      title = t('Unable to bill your account');
      body = billingPermissions
        ? t(
            `There was an issue with your payment. Update your payment information to ensure uninterrupted access to Sentry.`
          )
        : t(
            `There was an issue with your payment. Please have the Org Owner or Billing Member update your payment information to ensure continued access to Sentry.`
          );
      link = billingPermissions
        ? normalizeUrl(
            `/settings/${organization.slug}/billing/details/?referrer=banner-billing-failure`
          )
        : makeLinkToOwnersAndBillingMembers(organization, 'past_due_modal-alert');
      primaryButtonMessage = billingPermissions
        ? t('Update Billing Details')
        : t('See Who Can Update');
      break;
    case ModalType.MEMBER_LIMIT:
      title = t('Member limit exceeded');
      body = t(
        `You organization has more members than your current subscription
          allows. You will need to upgrade your subscription to ensure everyone
          has access to Sentry.`
      );
      link = normalizeUrl(`/settings/${organization.slug}/billing/overview/`);
      primaryButtonMessage = t('Continue');
      break;
    default:
  }

  if (subscription.usageExceeded || subscription.isGracePeriod) {
    if (subscription.isFree) {
      subText = subscription.canTrial
        ? t(
            `Not yet ready to upgrade? You can start a free %s-day trial with
               unlimited events to better understand your usage.`,
            getTrialLength(organization)
          )
        : t('To ensure uninterrupted service, upgrade your subscription.');
    } else {
      subText = tct(
        `To ensure uninterrupted service, upgrade your subscription or increase your [budgetTerm] spend limit.`,
        {
          budgetTerm: subscription.planDetails.budgetTerm,
        }
      );
    }
  }

  return (
    <Fragment>
      <Header data-test-id={`modal-${whichModal}`}>
        <h4>{t('Action Required')}</h4>
      </Header>
      <Body>
        <Alert.Container>
          <Alert variant={alertType}>{title}</Alert>
        </Alert.Container>
        <p>{body}</p>
        {subText && <p>{subText}</p>}
      </Body>
      <Footer>
        <Button onClick={() => closeModalDoNotContinue()}>{t('Remind Me Later')}</Button>
        <Button
          priority="primary"
          onClick={() => closeModalAndContinue(link)}
          style={{marginLeft: space(2)}}
          data-test-id="modal-continue-button"
        >
          {primaryButtonMessage}
        </Button>
      </Footer>
    </Fragment>
  );
}

type Props = {
  api: Client;
  isLoading: boolean;
  organization: Organization;
  promotionData: {
    activePromotions: PromotionClaimed[];
    availablePromotions: Promotion[];
    completedPromotions: PromotionClaimed[];
  };
  subscription: Subscription;
};

type State = {
  deactivatedMemberDismissed: boolean;
  overageAlertDismissed: Record<EventType, boolean>;
  overageWarningDismissed: Record<EventType, boolean>;
  productTrialDismissed: Record<EventType, boolean>;
};

class GSBanner extends Component<Props, State> {
  // assume dismissed until we've checked the backend
  state: State = {
    deactivatedMemberDismissed: true,
    overageAlertDismissed: objectFromBilledCategories(() => true),
    overageWarningDismissed: objectFromBilledCategories(() => true),
    productTrialDismissed: objectFromBilledCategories(() => true),
  };
  async componentDidMount() {
    if (this.props.promotionData) {
      this.activateFirstAvailablePromo()
        .then(() => this.initializePendo())
        .catch(Sentry.captureException);
    }
    if (this.props.organization.access.length > 0) {
      this.tryTriggerTrialEndingModal();
      this.tryTriggerSuspendedModal();
      this.tryTriggerNoticeModal();
      this.tryTriggerForcedTrial();
      this.tryTriggerForcedTrialModal();
      this.tryTriggerPartnerPlanEndingModal();
    }
    await this.checkPrompts();

    // must happen after prompts check
    if (this.overageAlertType !== null) {
      const {organization, subscription} = this.props;
      const isWarning = this.overageAlertType === 'warning';
      const eventTypes = Object.entries(
        isWarning ? this.overageWarningActive : this.overageAlertActive
      )
        .filter(([_, value]) => value)
        .map(([key, _]) => key as EventType);
      trackGetsentryAnalytics('quota_alert.alert_displayed', {
        organization,
        subscription,
        event_types: eventTypes.sort().join(','),
        is_warning: isWarning,
      });
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.promotionData !== prevProps.promotionData) {
      this.activateFirstAvailablePromo()
        .then(() => this.initializePendo())
        .catch(Sentry.captureException);
    }
  }

  get trialEndMoment() {
    return moment().add(TRIAL_ENDING_DAY_WINDOW, 'days');
  }

  get hasBillingPerms() {
    return this.props.organization?.access?.includes('org:billing');
  }

  async activateFirstAvailablePromo() {
    const {organization, promotionData, isLoading} = this.props;

    if (!isLoading && promotionData) {
      if (isActiveSuperuser()) {
        return;
      }
      await claimAvailablePromotion({
        promotionData,
        organization,
      });
    }
  }

  async initializePendo() {
    const {organization, subscription} = this.props;
    if (!window.pendo || typeof window.pendo.initialize !== 'function') {
      return;
    }
    try {
      const data = await this.props.api.requestPromise(
        `/organizations/${organization.slug}/pendo-details/`
      );

      const activePromotions = this.props.promotionData?.activePromotions;
      const completedPromotions = this.props.promotionData?.completedPromotions;

      const user = ConfigStore.get('user');
      // if there is a current guide active, delay Pendo until it's done
      // if no current active guide, can just start Pendo
      // TODO: should delay Pendo if there is any popup at all that's blocking and not just guides
      const guideIsActive = !!GuideStore.state.currentGuide;
      window.pendo.initialize({
        guides: {
          delay: guideIsActive,
        },
        visitor: {
          id: `${organization.id}.${user.id}`, // need uniqueness per org per user
          userId: user.id,
          role: organization.orgRole,
          isDarkMode: ConfigStore.get('theme') === 'dark',
          ...data.userDetails,
        },

        account: {
          id: organization.id,
          ...getPendoAccountFields(subscription, organization, {
            activePromotions,
            completedPromotions,
          }),
          ...data.organizationDetails,
        },
      });
    } catch (err) {
      // server will catch any 500 errors that need attention
      return;
    }
  }

  tryTriggerTrialEndingModal() {
    const {organization, subscription} = this.props;

    const trialEndingWindow = [moment(), this.trialEndMoment] as const;

    // Only show the trial notice if the user is on a business plan trial
    // Performance trials would require different content not currently supported
    const showTrialEndedNotice =
      !subscription.hasDismissedTrialEndingNotice &&
      subscription.canSelfServe &&
      isBusinessTrial(subscription) &&
      moment(subscription.trialEnd).isBetween(...trialEndingWindow);

    if (!showTrialEndedNotice) {
      return;
    }

    openTrialEndingModal({organization});
  }

  async tryTriggerPartnerPlanEndingModal() {
    const {organization, subscription, api} = this.props;
    const hasEndingPartnerPlan = hasPartnerMigrationFeature(organization);
    const hasPendingUpgrade =
      subscription.pendingChanges !== null &&
      subscription.pendingChanges?.planDetails.price > 0;
    const daysLeft = getContractDaysLeft(subscription);

    const showPartnerPlanEndingNotice =
      subscription.partner !== null &&
      !hasPendingUpgrade &&
      daysLeft >= 0 &&
      daysLeft <= 30 &&
      subscription.partner.isActive &&
      hasEndingPartnerPlan;

    if (!showPartnerPlanEndingNotice) {
      return;
    }

    let hasDismissed = true;
    const prompt = await promptsCheck(api, {
      organization,
      feature: 'partner_plan_ending_modal',
    });

    if (daysLeft > 7) {
      hasDismissed = partnerPlanEndingModalIsDismissed(prompt, subscription, 'month');
    } else if (daysLeft > 2) {
      hasDismissed = partnerPlanEndingModalIsDismissed(prompt, subscription, 'week');
    } else if (daysLeft > 0) {
      hasDismissed = partnerPlanEndingModalIsDismissed(prompt, subscription, 'two');
    } else if (daysLeft === 0) {
      hasDismissed = partnerPlanEndingModalIsDismissed(prompt, subscription, 'zero');
    }

    if (!hasDismissed) {
      openPartnerPlanEndingModal({organization, subscription});
    }
  }

  tryTriggerSuspendedModal() {
    const {subscription} = this.props;

    if (!subscription.isSuspended) {
      return;
    }

    openModal(props => <SuspensionModal {...props} subscription={subscription} />);
  }

  tryTriggerNoticeModal() {
    const {organization, subscription} = this.props;

    const whichModal = subscription.isGracePeriod
      ? ModalType.GRACE_PERIOD
      : subscription.usageExceeded
        ? ModalType.USAGE_EXCEEDED
        : subscription.isPastDue && subscription.canSelfServe
          ? ModalType.PAST_DUE
          : null;

    if (whichModal === null) {
      return;
    }
    // Only show USAGE_EXCEEDED or PAST_DUE for members
    if (
      !this.hasBillingPerms &&
      !(ModalType.USAGE_EXCEEDED || whichModal === ModalType.PAST_DUE)
    ) {
      return;
    }

    const cookie = Cookies.get('gsb');

    // Did they already see the modal?
    if (cookie?.split(',').includes(subscription.slug)) {
      return;
    }

    const modalAnalytics = {
      [ModalType.GRACE_PERIOD]: 'grace_period_modal.seen',
      [ModalType.USAGE_EXCEEDED]: 'usage_exceeded_modal.seen',
      [ModalType.PAST_DUE]: 'past_due_modal.seen',
    } as const;

    const eventKey = modalAnalytics[whichModal];
    const billingPermissions = this.hasBillingPerms;

    if (eventKey) {
      trackGetsentryAnalytics(eventKey, {organization, subscription});
    }
    if (eventKey === 'past_due_modal.seen') {
      trackGetsentryAnalytics('billing_failure.displayed_banner', {
        organization,
        has_permissions: billingPermissions,
        referrer: 'banner-billing-failure',
      });
    }

    const onClose = () => {
      let value = subscription.slug;
      if (cookie && !cookie.includes(value)) {
        value = `${cookie},${value}`;
      }
      const expires = new Date();
      expires.setDate(expires.getDate() + 1);
      document.cookie = `gsb=${value}; expires=${expires.toUTCString()}; path=/`;
    };

    openModal(
      props => (
        <NoticeModal
          {...props}
          {...{organization, subscription, whichModal, billingPermissions}}
        />
      ),
      {onClose}
    );
  }

  async tryTriggerForcedTrial() {
    const {organization, subscription, api} = this.props;
    const user = ConfigStore.get('user');

    // check for required conditions of triggering a forced trial of any type
    const considerTrigger =
      subscription.canSelfServe && // must be self serve
      subscription.isFree && // must be on Developer plan
      !subscription.isTrial && // don't trigger if already on a trial
      hasPerformance(subscription.planDetails) &&
      !subscription.isExemptFromForcedTrial && // orgs who ever did enterprise trials are exempt
      !user?.isSuperuser; // never trigger for superusers

    if (!considerTrigger) {
      return;
    }

    // mutliple possible trial endpoints depending on the situation
    let endpoint: string;
    // check for restricted integration
    if (subscription.hasRestrictedIntegration) {
      endpoint = `/organizations/${organization.slug}/restricted-integration-trial/`;
      // only trigger if member limit is 1 and we have multiple licenses used
    } else if (subscription.totalLicenses === 1 && subscription.usedLicenses > 1) {
      endpoint = `/organizations/${organization.slug}/over-member-limit-trial/`;
    } else {
      return;
    }

    try {
      await api.requestPromise(endpoint, {
        method: 'POST',
      });

      trackMarketingEvent('Start Trial');

      // Refresh organization and subscription state
      // do not mark the trial since we have this modal
      SubscriptionStore.loadData(organization.slug, null);
      fetchOrganizationDetails(api, organization.slug);

      openForcedTrialModal({organization});
    } catch (error) {
      // let check fail but capture exception
      Sentry.captureException(error);
    }
  }

  tryTriggerForcedTrialModal() {
    const {subscription, organization} = this.props;
    if (
      subscription.isTrial &&
      subscription.isForcedTrial &&
      !subscription.hasDismissedForcedTrialNotice
    ) {
      openForcedTrialModal({organization});
    }
  }

  async checkPrompts() {
    const {api, organization, subscription} = this.props;

    if (!subscription.planDetails) {
      return;
    }

    const category_overage_prompts: string[] = [];
    const category_warning_prompts: string[] = [];
    const category_product_trial_prompts: string[] = [];

    Object.values(BILLED_DATA_CATEGORY_INFO)
      .filter(
        categoryInfo =>
          categoryInfo.isBilledCategory &&
          subscription.planDetails.categories.includes(categoryInfo.plural)
      )
      .forEach(categoryInfo => {
        const snakeCasePlural = snakeCase(categoryInfo.plural);
        category_overage_prompts.push(`${snakeCasePlural}_overage_alert`);
        category_warning_prompts.push(`${snakeCasePlural}_warning_alert`);
        if (categoryInfo.canProductTrial) {
          category_product_trial_prompts.push(`${snakeCasePlural}_product_trial_alert`);
        }
      });

    try {
      const checkResults = await batchedPromptsCheck(
        api,
        [
          'deactivated_member_alert',

          // overage alerts
          ...category_overage_prompts,

          // warning alerts
          ...category_warning_prompts,

          // product trial alerts
          ...category_product_trial_prompts,
        ],
        {
          organization,
        }
      );

      // overage notifications should get reset when ondemand period ends
      const promptIsDismissedForBillingPeriod = (prompt: PromptData) => {
        const {snoozedTime, dismissedTime} = prompt || {};
        // TODO: dismissed prompt should always return false
        const time = snoozedTime || dismissedTime;
        if (!time) {
          return false;
        }
        const onDemandPeriodEnd = new Date(subscription.onDemandPeriodEnd);
        onDemandPeriodEnd.setHours(23, 59, 59);
        return time <= onDemandPeriodEnd.getTime() / 1000;
      };

      this.setState({
        // not billing related prompt checks
        deactivatedMemberDismissed: promptIsDismissed(
          checkResults.deactivated_member_alert!
        ),
        // billing period related prompt checks
        overageAlertDismissed: objectFromBilledCategories(c =>
          promptIsDismissedForBillingPeriod(
            checkResults[`${snakeCase(c.plural)}_overage_alert`]!
          )
        ),
        overageWarningDismissed: objectFromBilledCategories(c =>
          promptIsDismissedForBillingPeriod(
            checkResults[`${snakeCase(c.plural)}_warning_alert`]!
          )
        ),
        productTrialDismissed: objectFromBilledCategories(c =>
          trialPromptIsDismissed(
            checkResults[`${snakeCase(c.plural)}_product_trial_alert`]!,
            subscription
          )
        ),
      });
    } catch (error) {
      // let check fail but capture exception
      Sentry.captureException(error);
    }
  }

  get overageAlertActive(): Record<EventType, boolean> {
    const {subscription} = this.props;
    if (subscription.hasOverageNotificationsDisabled) {
      return ALERTS_OFF;
    }
    return objectFromBilledCategories(
      c =>
        !this.state.overageAlertDismissed[c.singular as EventType] &&
        !!subscription.categories[c.plural]?.usageExceeded
    );
  }

  get overageWarningActive(): Record<EventType, boolean> {
    const {subscription} = this.props;
    // disable warnings if org has PAYG
    if (
      subscription.hasOverageNotificationsDisabled ||
      subscription.onDemandMaxSpend > 0
    ) {
      return ALERTS_OFF;
    }
    return objectFromBilledCategories(
      c =>
        !this.state.overageWarningDismissed[c.singular as EventType] &&
        !!subscription.categories[c.plural]?.sentUsageWarning
    );
  }

  // Returns true for overage alert, false for overage warning, and null if we don't show anything.
  get overageAlertType(): 'critical' | 'warning' | null {
    const {subscription} = this.props;
    if (!hasPerformance(subscription.planDetails)) {
      return null;
    }
    if (!subscription.canSelfServe) {
      return null;
    }
    if (Object.values(this.overageAlertActive).some(a => a)) {
      return 'critical';
    }

    if (Object.values(this.overageWarningActive).some(a => a)) {
      return 'warning';
    }
    return null;
  }

  renderOverageAlertPrimaryCTA(eventTypes: EventType[], isWarning: boolean) {
    const {subscription, organization} = this.props;

    // can't use as const with ternary
    const notificationType: 'overage_warning' | 'overage_critical' = isWarning
      ? 'overage_warning'
      : 'overage_critical';

    const props = {
      organization,
      subscription,
      eventTypes,
      notificationType,
      referrer: `overage-alert-${eventTypes.join('-')}`,
      source: isWarning ? 'quota-warning' : 'quota-overage',
      handleRequestSent: () => this.handleOverageSnooze(eventTypes, isWarning),
    };

    return <AddEventsCTA {...props} />;
  }

  handleOverageSnooze(eventTypes: EventType[], isWarning: boolean) {
    const {organization, api} = this.props;
    const dismissState: Record<EventType, boolean> = isWarning
      ? this.state.overageWarningDismissed
      : this.state.overageAlertDismissed;

    for (const eventType of eventTypes) {
      if (dismissState[eventType]) {
        // This type of event is already dismissed. Skip.
        continue;
      }
      const key = isWarning ? 'warning' : 'overage';

      const featureMap = objectFromBilledCategories(
        c => `${snakeCase(c.plural)}_${key}_alert`
      );

      promptsUpdate(api, {
        organization,
        feature: featureMap[eventType],
        status: 'snoozed',
      });
    }

    const dismissedState: Record<EventType, boolean> = objectFromBilledCategories(
      () => true
    );
    // Suppress all warnings and alerts
    this.setState({
      overageAlertDismissed: dismissedState,
      overageWarningDismissed: dismissedState,
    });
  }

  handleSnoozeMemberDeactivatedAlert = () => {
    const {api, organization, subscription} = this.props;
    promptsUpdate(api, {
      organization,
      feature: 'deactivated_member_alert',
      status: 'snoozed',
    });

    this.setState({deactivatedMemberDismissed: true});

    trackGetsentryAnalytics('deactivated_member_alert.snoozed', {
      organization,
      subscription,
    });
  };

  handleUpgradeLinkClick = () => {
    const {organization, subscription} = this.props;
    trackGetsentryAnalytics('deactivated_member_alert.upgrade_link_clicked', {
      organization,
      subscription,
    });
  };

  PATHS_FOR_PRODUCT_TRIALS = {
    '/issues/': {
      product: DataCategory.ERRORS,
      categories: [DataCategory.ERRORS],
    },
    '/performance/': {
      product: DataCategory.TRANSACTIONS,
      categories: [DataCategory.TRANSACTIONS],
    },
    '/performance/database/': {
      product: DataCategory.TRANSACTIONS,
      categories: [DataCategory.TRANSACTIONS],
    },
    '/replays/': {
      product: DataCategory.REPLAYS,
      categories: [DataCategory.REPLAYS],
    },
    '/profiling/': {
      product: DataCategory.PROFILES,
      categories: [DataCategory.PROFILES, DataCategory.TRANSACTIONS],
    },
    '/insights/crons/': {
      product: DataCategory.MONITOR_SEATS,
      categories: [DataCategory.MONITOR_SEATS],
    },
    '/insights/uptime/': {
      product: DataCategory.UPTIME,
      categories: [DataCategory.UPTIME],
    },
    // TODO(Continuous Profiling)
    '/profile-duration/': {
      product: DataCategory.PROFILE_DURATION,
      categories: [DataCategory.PROFILE_DURATION],
    },
    '/profile-duration-ui/': {
      product: DataCategory.PROFILE_DURATION_UI,
      categories: [DataCategory.PROFILE_DURATION_UI],
    },
  };

  renderProductTrialAlerts() {
    const {subscription, organization, api} = this.props;

    const productPath = getProductForPath(subscription, window.location.pathname);
    if (!productPath) {
      return null;
    }

    return productPath.categories
      .map((category: DataCategory) => {
        const categoryInfo = getCategoryInfoFromPlural(category);
        const categorySnakeCase = snakeCase(category);
        const isDismissed =
          this.state.productTrialDismissed[categoryInfo?.singular as EventType];
        const trial = getProductTrial(subscription.productTrials ?? null, category);
        return trial && !isDismissed ? (
          <ProductTrialAlert
            key={`${category}-product-trial-alert`}
            trial={trial}
            subscription={subscription}
            organization={organization}
            product={productPath.product}
            api={api}
            onDismiss={() => {
              promptsUpdate(api, {
                organization,
                feature: `${categorySnakeCase}_product_trial_alert`,
                status: 'snoozed',
              });
              this.setState({
                productTrialDismissed: {
                  ...this.state.productTrialDismissed,
                  [categoryInfo?.singular as EventType]: true,
                },
              });
            }}
          />
        ) : null;
      })
      .filter((node: any) => node);
  }

  render() {
    const {organization, subscription} = this.props;
    const {deactivatedMemberDismissed} = this.state;

    if (!subscription) {
      return null;
    }

    /**
     * Alert priority:
     * 1. Past due alert
     * 2. Overage alerts
     * 3. Member disabled alerts
     */

    // TODO: Clean up render function
    if (subscription.isPastDue && subscription.canSelfServe) {
      const billingPermissions = this.hasBillingPerms;
      const billingUrl = normalizeUrl(
        `/settings/${organization.slug}/billing/details/?referrer=banner-billing-failure`
      );
      const membersPageUrl = makeLinkToOwnersAndBillingMembers(
        organization,
        'past_due_banner-alert'
      );
      const addButtonAnalytics = () => {
        trackGetsentryAnalytics('billing_failure.button_clicked', {
          organization,
          has_permissions: billingPermissions,
          referrer: 'banner-billing-failure',
        });
      };

      return (
        <Alert.Container>
          <Alert
            system
            variant="danger"
            data-test-id="banner-alert-past-due"
            trailingItems={
              <Flex align="center" height="100%">
                <Tag variant="danger">{t('Action Required')}</Tag>
              </Flex>
            }
          >
            {billingPermissions
              ? tct(
                  'There was an issue with your payment. [updateUrl:Update your payment information] to ensure uninterrupted access to Sentry.',
                  {
                    updateUrl: (
                      <LinkButton
                        to={billingUrl}
                        size="zero"
                        priority="default"
                        aria-label={t('Update payment information')}
                        onClick={addButtonAnalytics}
                      />
                    ),
                  }
                )
              : tct(
                  'There was an issue with your payment. Please have the [updateUrl: Org Owner or Billing Member] update your payment information to ensure continued access to Sentry.',
                  {
                    updateUrl: (
                      <LinkButton
                        to={membersPageUrl}
                        size="zero"
                        priority="default"
                        aria-label={t('Org Owner or Billing Member')}
                        onClick={addButtonAnalytics}
                      />
                    ),
                  }
                )}
          </Alert>
        </Alert.Container>
      );
    }

    const productTrialAlerts = this.renderProductTrialAlerts();

    const overageAlertType = this.overageAlertType;
    if (overageAlertType !== null) {
      return (
        <React.Fragment>
          {productTrialAlerts && productTrialAlerts.length > 0 && productTrialAlerts}
        </React.Fragment>
      );
    }

    const {membersDeactivatedFromLimit} = subscription;
    const isOverMemberLimit = membersDeactivatedFromLimit > 0;

    // if there are deactivated members, than anyone who doesn't have org:billing will be
    // prevented from accessing this view anyways cause they will be deactivated
    if (isOverMemberLimit && !deactivatedMemberDismissed && this.hasBillingPerms) {
      const checkoutUrl = `/checkout/${organization.slug}/?referrer=deactivated_member_header`;
      const wrappedNumber = <strong>{membersDeactivatedFromLimit}</strong>;
      // only disabling members if the plan allows exactly one member
      return (
        <React.Fragment>
          {productTrialAlerts && productTrialAlerts.length > 0 && productTrialAlerts}
          <Alert.Container>
            <InvertedAlert
              trailingItems={
                <ButtonBar>
                  <LinkButton
                    to={checkoutUrl}
                    onClick={this.handleUpgradeLinkClick}
                    size="xs"
                    priority="primary"
                  >
                    {t('Upgrade')}
                  </LinkButton>
                  <Button
                    onClick={this.handleSnoozeMemberDeactivatedAlert}
                    size="xs"
                    priority="default"
                    title={t(
                      'You can also resolve this warning by removing the deactivated members from your organization'
                    )}
                  >
                    {t('Snooze')}
                  </Button>
                </ButtonBar>
              }
            >
              {tct(
                `[firstSentence] [middleSentence] Upgrade your plan to increase your limit.`,
                {
                  firstSentence:
                    subscription.totalLicenses === 1
                      ? t('Your plan is limited to one user.')
                      : tct('Your plan is limited to [totalLicenses] users.', {
                          totalLicenses: subscription.totalLicenses,
                        }),
                  middleSentence:
                    membersDeactivatedFromLimit === 1
                      ? tct('[wrappedNumber] member has been deactivated.', {
                          wrappedNumber,
                        })
                      : tct('[wrappedNumber] members have been deactivated.', {
                          wrappedNumber,
                        }),
                }
              )}
            </InvertedAlert>
          </Alert.Container>
        </React.Fragment>
      );
    }

    return productTrialAlerts ?? null;
  }
}

export default withPromotions(withApi(withSubscription(GSBanner, {noLoader: true})));

function InvertedAlert(props: Omit<AlertProps, 'system' | 'variant'>) {
  const invertedTheme = useInvertedTheme();

  return (
    <ThemeProvider theme={invertedTheme}>
      <Alert system variant="info" {...props} />
    </ThemeProvider>
  );
}
