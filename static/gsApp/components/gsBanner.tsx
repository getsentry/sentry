import React, {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import Cookies from 'js-cookie';
import moment from 'moment-timezone';

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
import {Alert} from 'sentry/components/alert';
import Badge from 'sentry/components/badge/badge';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';
import {space} from 'sentry/styles/space';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {Oxfordize} from 'sentry/utils/oxfordizeArray';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withApi from 'sentry/utils/withApi';
import {getDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';

import {
  openForcedTrialModal,
  openPartnerPlanEndingModal,
  openTrialEndingModal,
} from 'getsentry/actionCreators/modal';
import type {EventType} from 'getsentry/components/addEventsCTA';
import AddEventsCTA from 'getsentry/components/addEventsCTA';
import ProductTrialAlert from 'getsentry/components/productTrial/productTrialAlert';
import {makeLinkToOwnersAndBillingMembers} from 'getsentry/components/profiling/alerts';
import withSubscription from 'getsentry/components/withSubscription';
import ZendeskLink from 'getsentry/components/zendeskLink';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {
  PlanTier,
  type Promotion,
  type PromotionClaimed,
  type Subscription,
} from 'getsentry/types';
import {
  getActiveProductTrial,
  getContractDaysLeft,
  getProductTrial,
  getTrialLength,
  hasPerformance,
  isBusinessTrial,
  partnerPlanEndingModalIsDismissed,
  trialPromptIsDismissed,
} from 'getsentry/utils/billing';
import {getSingularCategoryName} from 'getsentry/utils/dataCategory';
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

const ALERTS_OFF: Record<EventType, boolean> = {
  error: false,
  transaction: false,
  replay: false,
  attachment: false,
  monitorSeat: false,
  span: false,
  profileDuration: false,
  uptime: false,
};

type SuspensionModalProps = ModalRenderProps & {
  subscription: Subscription;
};

function SuspensionModal({Header, Body, Footer, subscription}: SuspensionModalProps) {
  return (
    <Fragment>
      <Header>{'Action Required'}</Header>
      <Body>
        <Alert type="warning" showIcon>
          {t('Your account has been suspended')}
        </Alert>
        <p>{t('Your account has been suspended with the following reason:')}</p>
        <ul>
          <li>
            <strong>{subscription.suspensionReason}</strong>
          </li>
        </ul>
        <p>
          {t(
            'Until this situation is resolved you will not be able to send events to Sentry.'
          )}
        </p>
      </Body>
      <Footer>
        <ZendeskLink
          subject="Account Suspension"
          className="btn btn-primary"
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
    browserHistory.push(link);
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

  const alertType = whichModal === ModalType.PAST_DUE ? 'error' : 'warning';

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
            `There was an issue with your payment. Update your payment information to ensure uniterrupted access to Sentry.`
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
      if (subscription.planTier === PlanTier.AM3) {
        subText = t(
          `To ensure uninterrupted service, upgrade your subscription or increase your pay-as-you-go spend limit.`
        );
      } else {
        subText = t(
          `To ensure uninterrupted service, upgrade your subscription or increase your on-demand spend limit.`
        );
      }
    }
  }

  return (
    <Fragment>
      <Header data-test-id={`modal-${whichModal}`}>
        <h4>{t('Action Required')}</h4>
      </Header>
      <Body>
        <Alert type={alertType} showIcon>
          {title}
        </Alert>
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
  overageAlertDismissed: {[key in EventType]: boolean};

  overageWarningDismissed: {[key in EventType]: boolean};
  productTrialDismissed: {[key in EventType]: boolean};
};

class GSBanner extends Component<Props, State> {
  // assume dismissed until we've checked the backend
  state: State = {
    deactivatedMemberDismissed: true,
    overageAlertDismissed: {
      error: true,
      transaction: true,
      replay: true,
      attachment: true,
      monitorSeat: true,
      span: true,
      profileDuration: true,
      uptime: true,
    },
    overageWarningDismissed: {
      error: true,
      transaction: true,
      replay: true,
      attachment: true,
      monitorSeat: true,
      span: true,
      profileDuration: true,
      uptime: true,
    },
    productTrialDismissed: {
      error: true,
      transaction: true,
      replay: true,
      attachment: true,
      monitorSeat: true,
      span: true,
      profileDuration: true,
      uptime: true,
    },
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
    const hasPartnerMigrationFeature = organization.features.includes(
      'partner-billing-migration'
    );
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
      hasPartnerMigrationFeature;

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
      subscription.isFree &&
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
      fetchOrganizationDetails(api, organization.slug, true, true);

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

    try {
      const checkResults = await batchedPromptsCheck(
        api,
        [
          'deactivated_member_alert',

          // overage alerts
          'errors_overage_alert',
          'attachments_overage_alert',
          'transactions_overage_alert',
          'replays_overage_alert',
          'monitor_seats_overage_alert',
          'spans_overage_alert',
          'profile_duration_overage_alert',
          'uptime_overage_alert',

          // warning alerts
          'errors_warning_alert',
          'attachments_warning_alert',
          'transactions_warning_alert',
          'replays_warning_alert',
          'monitor_seats_warning_alert',
          'spans_warning_alert',
          'profile_duration_warning_alert',
          'uptime_warning_alert',

          // product trial alerts
          'errors_product_trial_alert',
          'attachments_product_trial_alert',
          'transactions_product_trial_alert',
          'replays_product_trial_alert',
          'monitor_seats_product_trial_alert',
          'spans_product_trial_alert',
          'profile_duration_product_trial_alert',
          'uptime_product_trial_alert',
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
        overageAlertDismissed: {
          error: promptIsDismissedForBillingPeriod(checkResults.errors_overage_alert!),
          transaction: promptIsDismissedForBillingPeriod(
            checkResults.transactions_overage_alert!
          ),
          replay: promptIsDismissedForBillingPeriod(checkResults.replays_overage_alert!),
          attachment: promptIsDismissedForBillingPeriod(
            checkResults.attachments_overage_alert!
          ),
          monitorSeat: promptIsDismissedForBillingPeriod(
            checkResults.monitor_seats_overage_alert!
          ),
          span: promptIsDismissedForBillingPeriod(checkResults.spans_overage_alert!),
          profileDuration: promptIsDismissedForBillingPeriod(
            checkResults.profile_duration_overage_alert!
          ),
          uptime: promptIsDismissedForBillingPeriod(checkResults.uptime_overage_alert!),
        },
        overageWarningDismissed: {
          error: promptIsDismissedForBillingPeriod(checkResults.errors_warning_alert!),
          transaction: promptIsDismissedForBillingPeriod(
            checkResults.transactions_warning_alert!
          ),
          replay: promptIsDismissedForBillingPeriod(checkResults.replays_warning_alert!),
          attachment: promptIsDismissedForBillingPeriod(
            checkResults.attachments_warning_alert!
          ),
          monitorSeat: promptIsDismissedForBillingPeriod(
            checkResults.monitor_seats_warning_alert!
          ),
          span: promptIsDismissedForBillingPeriod(checkResults.spans_warning_alert!),
          profileDuration: promptIsDismissedForBillingPeriod(
            checkResults.profile_duration_warning_alert!
          ),
          uptime: promptIsDismissedForBillingPeriod(checkResults.uptime_warning_alert!),
        },

        productTrialDismissed: {
          error: trialPromptIsDismissed(
            checkResults.errors_product_trial_alert!,
            subscription
          ),
          transaction: trialPromptIsDismissed(
            checkResults.transactions_product_trial_alert!,
            subscription
          ),
          replay: trialPromptIsDismissed(
            checkResults.replays_product_trial_alert!,
            subscription
          ),
          attachment: trialPromptIsDismissed(
            checkResults.attachments_product_trial_alert!,
            subscription
          ),
          monitorSeat: trialPromptIsDismissed(
            checkResults.monitor_seats_product_trial_alert!,
            subscription
          ),
          span: trialPromptIsDismissed(
            checkResults.spans_product_trial_alert!,
            subscription
          ),
          profileDuration: trialPromptIsDismissed(
            checkResults.profile_duration_product_trial_alert!,
            subscription
          ),
          uptime: trialPromptIsDismissed(
            checkResults.uptime_product_trial_alert!,
            subscription
          ),
        },
      });
    } catch (error) {
      // let check fail but capture exception
      Sentry.captureException(error);
    }
  }

  get overageAlertActive(): {[key in EventType]: boolean} {
    const {subscription} = this.props;
    if (subscription.hasOverageNotificationsDisabled) {
      return ALERTS_OFF;
    }
    return {
      error:
        !this.state.overageAlertDismissed.error &&
        !!subscription.categories.errors?.usageExceeded,
      transaction:
        !this.state.overageAlertDismissed.transaction &&
        !!subscription.categories.transactions?.usageExceeded,
      replay:
        !this.state.overageAlertDismissed.replay &&
        !!subscription.categories.replays?.usageExceeded,
      attachment:
        !this.state.overageAlertDismissed.attachment &&
        !!subscription.categories.attachments?.usageExceeded,
      monitorSeat:
        !this.state.overageAlertDismissed.monitorSeat &&
        !!subscription.categories.monitorSeats?.usageExceeded,
      span:
        !this.state.overageAlertDismissed.span &&
        !!subscription.categories.spans?.usageExceeded,
      profileDuration:
        !this.state.overageAlertDismissed.profileDuration &&
        !!subscription.categories.profileDuration?.usageExceeded,
      uptime:
        !this.state.overageAlertDismissed.uptime &&
        !!subscription.categories.uptime?.usageExceeded,
    };
  }

  get overageWarningActive(): {[key in EventType]: boolean} {
    const {subscription} = this.props;
    // disable warnings if org has on-demand
    if (
      subscription.hasOverageNotificationsDisabled ||
      subscription.onDemandMaxSpend > 0
    ) {
      return ALERTS_OFF;
    }
    return {
      error:
        !this.state.overageWarningDismissed.error &&
        !!subscription.categories.errors?.sentUsageWarning,
      transaction:
        !this.state.overageWarningDismissed.transaction &&
        !!subscription.categories.transactions?.sentUsageWarning,
      replay:
        !this.state.overageWarningDismissed.replay &&
        !!subscription.categories.replays?.sentUsageWarning,
      attachment:
        !this.state.overageWarningDismissed.attachment &&
        !!subscription.categories.attachments?.sentUsageWarning,
      monitorSeat:
        !this.state.overageWarningDismissed.monitorSeat &&
        !!subscription.categories.monitorSeats?.sentUsageWarning,
      span:
        !this.state.overageWarningDismissed.span &&
        !!subscription.categories.spans?.sentUsageWarning,
      profileDuration:
        !this.state.overageWarningDismissed.profileDuration &&
        !!subscription.categories.profileDuration?.sentUsageWarning,
      uptime:
        !this.state.overageWarningDismissed.uptime &&
        !!subscription.categories.uptime?.sentUsageWarning,
    };
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
    const dismissState: {[key in EventType]: boolean} = isWarning
      ? this.state.overageWarningDismissed
      : this.state.overageAlertDismissed;

    for (const eventType of eventTypes) {
      if (dismissState[eventType]) {
        // This type of event is already dismissed. Skip.
        continue;
      }
      const key = isWarning ? 'warning' : 'overage';

      const featureMap: Record<EventType, string> = {
        error: `errors_${key}_alert`,
        transaction: `transactions_${key}_alert`,
        replay: `replays_${key}_alert`,
        attachment: `attachments_${key}_alert`,
        monitorSeat: `monitor_seats_${key}_alert`,
        span: `spans_${key}_alert`,
        profileDuration: `profile_duration_${key}_alert`,
        uptime: `uptime_${key}_alert`,
      };

      promptsUpdate(api, {
        organization,
        feature: featureMap[eventType],
        status: 'snoozed',
      });
    }

    const dismissedState: {[key in EventType]: boolean} = {
      error: true,
      attachment: true,
      replay: true,
      transaction: true,
      monitorSeat: true,
      span: true,
      profileDuration: true,
      uptime: true,
    };
    // Suppress all warnings and alerts
    this.setState({
      overageAlertDismissed: dismissedState,
      overageWarningDismissed: dismissedState,
    });
  }

  renderOverageAlert(isWarning: boolean) {
    const {organization, subscription} = this.props;
    const plan = subscription.planDetails;
    let overquotaPrompt: React.ReactNode;
    let eventTypes: EventType[] = [];

    const eventTypeToElement = (eventType: EventType): JSX.Element => {
      const onClick = () => {
        trackGetsentryAnalytics('quota_alert.clicked_link', {
          organization,
          subscription,
          event_types: eventTypes.sort().join(','),
          is_warning: isWarning,
          clicked_event: eventType,
        });
      };
      // @ts-expect-error TS(2339): Property 'profileDuration' does not exist on type ... Remove this comment to see the full error message
      return {
        error: (
          <ExternalLink
            key="error"
            href={getDocsLinkForEventType(DataCategoryExact.ERROR)}
            onClick={onClick}
          >
            {getSingularCategoryName({
              plan,
              category: DataCategory.ERRORS,
              capitalize: false,
            })}
          </ExternalLink>
        ),
        transaction: (
          <ExternalLink
            key="transaction"
            href={getDocsLinkForEventType(DataCategoryExact.TRANSACTION)}
            onClick={onClick}
          >
            {getSingularCategoryName({
              plan,
              category: DataCategory.TRANSACTIONS,
              capitalize: false,
            })}
          </ExternalLink>
        ),
        replay: (
          <ExternalLink
            key="replay"
            href={getDocsLinkForEventType(DataCategoryExact.REPLAY)}
            onClick={onClick}
          >
            {getSingularCategoryName({
              plan,
              category: DataCategory.REPLAYS,
              capitalize: false,
            })}
          </ExternalLink>
        ),
        attachment: (
          <ExternalLink
            key="attachment"
            href={getDocsLinkForEventType(DataCategoryExact.ATTACHMENT)}
            onClick={onClick}
          >
            {getSingularCategoryName({
              plan,
              category: DataCategory.ATTACHMENTS,
              capitalize: false,
            })}
          </ExternalLink>
        ),
        monitorSeat: (
          <ExternalLink
            key="monitor-seats"
            href={getDocsLinkForEventType(DataCategoryExact.MONITOR_SEAT)}
            onClick={onClick}
          >
            {getSingularCategoryName({
              plan,
              category: DataCategory.MONITOR_SEATS,
              capitalize: false,
            })}
          </ExternalLink>
        ),
        span: (
          <ExternalLink
            key="spans"
            href={getDocsLinkForEventType(DataCategoryExact.SPAN)}
            onClick={onClick}
          >
            {getSingularCategoryName({
              plan,
              category: DataCategory.SPANS,
              capitalize: false,
            })}
          </ExternalLink>
        ),
        uptime: (
          <ExternalLink
            key="uptime"
            href={getDocsLinkForEventType(DataCategoryExact.UPTIME)}
            onClick={onClick}
          >
            {getSingularCategoryName({
              plan,
              category: DataCategory.UPTIME,
              capitalize: false,
            })}
          </ExternalLink>
        ),
        // TODO: Uncomment when we have a continuous profile doc link
        // profile: (
        //   <ExternalLink
        //     key="profiles"
        //     href={getDocsLinkForEventType(DataCategoryExact.PROFILE)}
        //     onClick={onClick}
        //   >
        //     {getSingularCategoryName({
        //       plan,
        //       category: DataCategory.PROFILES,
        //       capitalize: false,
        //     })}
        //   </ExternalLink>
        // ),
      }[eventType]!;
    };

    let strictlyCronsOverage = false;
    if (isWarning) {
      eventTypes = Object.entries(this.overageWarningActive)
        .filter(
          ([key, value]) =>
            value &&
            getActiveProductTrial(
              subscription.productTrials ?? null,
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              DATA_CATEGORY_INFO[key].plural
            ) === null
        )
        .map(([key, _]) => key as EventType);

      // Make an exception for when only crons has an overage to disable the See Usage button
      strictlyCronsOverage = eventTypes.length === 1 && eventTypes[0] === 'monitorSeat';
      overquotaPrompt = tct(
        'You are about to exceed your [eventTypes] limit and we will drop any excess events.',
        {
          eventTypes: (
            <b>
              <Oxfordize>{eventTypes.map(eventTypeToElement)}</Oxfordize>
            </b>
          ),
        }
      );
    } else {
      eventTypes = Object.entries(this.overageAlertActive)
        .filter(
          ([key, value]) =>
            value &&
            getActiveProductTrial(
              subscription.productTrials ?? null,
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              DATA_CATEGORY_INFO[key].plural
            ) === null
        )
        .map(([key, _]) => key as EventType);

      // Make an exception for when only crons has an overage to change the language to be more fitting and hide See Usage
      if (
        eventTypes.length === 1 &&
        (eventTypes[0] === 'monitorSeat' || eventTypes[0] === 'uptime')
      ) {
        overquotaPrompt = tct(
          `We can't enable additional [monitorTitle] because you don't have a sufficient [budgetType] budget.`,
          {
            monitorTitle:
              eventTypes[0] === 'monitorSeat' ? 'Cron Monitors' : 'Uptime Monitors',
            budgetType:
              subscription.planTier === PlanTier.AM3 ? 'pay-as-you-go' : 'on-demand',
          }
        );
      } else {
        overquotaPrompt = tct(
          'You have exceeded your [eventTypes] limit. We are dropping any excess events until [periodEnd].',
          {
            eventTypes: (
              <b>
                <Oxfordize>{eventTypes.map(eventTypeToElement)}</Oxfordize>
              </b>
            ),
            periodEnd: moment(subscription.onDemandPeriodEnd).add(1, 'days').format('ll'),
          }
        );
      }
    }

    if (eventTypes.length === 0) {
      return null;
    }

    return (
      <StyledAlert
        system
        type={isWarning ? 'muted' : 'warning'}
        showIcon
        data-test-id={'overage-banner-' + eventTypes.join('-')}
        trailingItems={
          <ButtonBar gap={1}>
            {!strictlyCronsOverage && (
              <LinkButton
                size="xs"
                to={`/organizations/${organization.slug}/stats/?dataCategory=${eventTypes[0]}s&pageStart=${subscription.onDemandPeriodStart}&pageEnd=${subscription.onDemandPeriodEnd}&pageUtc=true`}
                onClick={() => {
                  trackGetsentryAnalytics('quota_alert.clicked_see_usage', {
                    organization,
                    subscription,
                    event_types: eventTypes.sort().join(','),
                    is_warning: isWarning,
                  });
                }}
              >
                {t('See Usage')}
              </LinkButton>
            )}
            {this.renderOverageAlertPrimaryCTA(eventTypes, isWarning)}
            <Button
              icon={<IconClose size="sm" />}
              data-test-id="btn-overage-notification-snooze"
              onClick={() => {
                trackGetsentryAnalytics('quota_alert.clicked_snooze', {
                  organization,
                  subscription,
                  event_types: eventTypes.sort().join(','),
                  is_warning: isWarning,
                });
                this.handleOverageSnooze(eventTypes, isWarning);
              }}
              size="zero"
              borderless
              title={t('Dismiss this period')}
              aria-label={t('Dismiss this period')}
            />
          </ButtonBar>
        }
      >
        {overquotaPrompt}
      </StyledAlert>
    );
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
    '/insights/backend/crons/': {
      product: DataCategory.MONITOR_SEATS,
      categories: [DataCategory.MONITOR_SEATS],
    },
    '/insights/backend/uptime/': {
      product: DataCategory.UPTIME,
      categories: [DataCategory.UPTIME],
    },
  };

  renderProductTrialAlerts() {
    const {subscription, organization, api} = this.props;
    if (subscription.planTier === PlanTier.AM3) {
      this.PATHS_FOR_PRODUCT_TRIALS['/performance/'] = {
        product: DataCategory.SPANS,
        categories: [DataCategory.SPANS],
      };
      this.PATHS_FOR_PRODUCT_TRIALS['/performance/database/'] = {
        product: DataCategory.SPANS,
        categories: [DataCategory.SPANS],
      };
    }
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const productPath = this.PATHS_FOR_PRODUCT_TRIALS[window.location.pathname] || null;

    if (!productPath) {
      return null;
    }

    return productPath.categories
      .map((category: DataCategory) => {
        const categorySnakeCase = category.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
        const categorySnakeCaseSingular = categorySnakeCase.substring(
          0,
          categorySnakeCase.length - 1
        );
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const isDismissed = this.state.productTrialDismissed[categorySnakeCaseSingular];
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
                  [categorySnakeCaseSingular]: true,
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
        <BannerAlert
          system
          data-test-id="banner-alert-past-due"
          type="muted"
          trailingItems={<Badge text="Action Required" type="warning" />}
        >
          {billingPermissions
            ? tct(
                'There was an issue with your payment. [updateUrl:Update your payment information] to ensure uninterrupted access to Sentry.',
                {
                  updateUrl: (
                    <Button
                      to={billingUrl}
                      size="xs"
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
                    <Button
                      to={membersPageUrl}
                      size="xs"
                      priority="default"
                      aria-label={t('Org Owner or Billing Member')}
                      onClick={addButtonAnalytics}
                    />
                  ),
                }
              )}
        </BannerAlert>
      );
    }

    const productTrialAlerts = this.renderProductTrialAlerts();

    const overageAlertType = this.overageAlertType;
    if (overageAlertType !== null) {
      return (
        <React.Fragment>
          {productTrialAlerts && productTrialAlerts.length > 0 && productTrialAlerts}
          {this.renderOverageAlert(overageAlertType === 'warning')}
        </React.Fragment>
      );
    }

    const {membersDeactivatedFromLimit} = subscription;
    const isOverMemberLimit = membersDeactivatedFromLimit > 0;

    // if there are deactivated members, than anyone who doesn't have org:billing will be
    // prevented from accessing this view anyways cause they will be deactivated
    if (isOverMemberLimit && !deactivatedMemberDismissed && this.hasBillingPerms) {
      const checkoutUrl = `/settings/${organization.slug}/billing/checkout/?referrer=deactivated_member_header`;
      const wrappedNumber = <strong>{membersDeactivatedFromLimit}</strong>;
      // only disabling members if the plan allows exactly one member
      return (
        <React.Fragment>
          {productTrialAlerts && productTrialAlerts.length > 0 && productTrialAlerts}
          <BannerAlert
            system
            type="muted"
            trailingItems={
              <ButtonBar gap={1}>
                <Button
                  to={checkoutUrl}
                  onClick={this.handleUpgradeLinkClick}
                  size="xs"
                  priority="primary"
                >
                  {t('Upgrade')}
                </Button>
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
                    ? tct('[wrappedNumber] member has been deactivated.', {wrappedNumber})
                    : tct('[wrappedNumber] members have been deactivated.', {
                        wrappedNumber,
                      }),
              }
            )}
          </BannerAlert>
        </React.Fragment>
      );
    }

    return productTrialAlerts ?? null;
  }
}

export default withPromotions(withApi(withSubscription(GSBanner, {noLoader: true})));

// XXX: We have no alert types with this styling, but for now we would like for
// it to be differentiated.
const BannerAlert = styled(Alert)`
  color: ${p => p.theme.headerBackground};
  background-color: ${p => p.theme.bannerBackground};
  border: none;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;
