import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {Client} from 'sentry/api';
import {tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Reservations} from 'getsentry/components/upgradeNowModal/types';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Invoice, Plan, PreviewData, Subscription} from 'getsentry/types';
import {displayBudgetName, hasBillingAccess, supportsPayg} from 'getsentry/utils/billing';
import type {AM2UpdateSurfaces} from 'getsentry/utils/trackGetsentryAnalytics';

type UpsellModalOptions = {
  organization: Organization;
  source: string;
};

export async function openUpsellModal(options: UpsellModalOptions) {
  const {default: Modal, modalCss} = await import('getsentry/components/upsellModal');
  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type TrialModalProps = {
  organization: Organization;
};

type PartnerPlanModalProps = {
  organization: Organization;
  subscription: Subscription;
};

function genTrialModalOnClose(
  options: TrialModalProps,
  type: 'trialEnd' | 'forcedTrial'
) {
  let feature: string, subField: string;
  switch (type) {
    case 'trialEnd':
      feature = 'trial_ended_notice';
      subField = 'hasDismissedTrialEndingNotice';
      break;
    case 'forcedTrial':
      feature = 'forced_trial_notice';
      subField = 'hasDismissedForcedTrialNotice';
      break;
    default:
      throw new Error('Unexpected type');
  }
  const api = new Client();
  const promptParams = {
    organization: options.organization,
    feature,
    status: 'dismissed',
  } as const;
  const subUpdate = {
    [subField]: true,
  } as const;

  // Handle marking the feature prompt as seen when the modal is
  // closed
  return () => {
    promptsUpdate(api, promptParams);
    SubscriptionStore.set(options.organization.slug, subUpdate);
  };
}

export async function openTrialEndingModal(options: TrialModalProps) {
  const {default: Modal, modalCss} =
    await import('getsentry/components/trialEndingModal');

  const onClose = genTrialModalOnClose(options, 'trialEnd');

  openModal(deps => <Modal {...deps} {...options} />, {modalCss, onClose});
}

export async function openForcedTrialModal(options: TrialModalProps) {
  const {default: Modal, modalCss} =
    await import('getsentry/components/forcedTrialModal');

  const onClose = genTrialModalOnClose(options, 'forcedTrial');

  openModal(deps => <Modal {...deps} {...options} />, {
    modalCss,
    onClose,
  });
}

export async function openPartnerPlanEndingModal(options: PartnerPlanModalProps) {
  const {default: Modal, modalCss} =
    await import('getsentry/components/partnerPlanEndingModal');
  const api = new Client();
  const promptParams = {
    organization: options.organization,
    feature: 'partner_plan_ending_modal',
    status: 'dismissed',
  } as const;

  const onClose = () => {
    promptsUpdate(api, promptParams);
  };

  openModal(deps => <Modal {...deps} {...options} />, {modalCss, onClose});
}

interface OpenOnDemandBudgetEditModalProps {
  organization: Organization;
  subscription: Subscription;
  theme?: Theme;
}

export async function openOnDemandBudgetEditModal(
  options: OpenOnDemandBudgetEditModalProps
) {
  const {default: Modal} = await import('getsentry/views/spendLimits/editModal');
  const {theme, organization, subscription} = options;
  const hasBillingPerms = hasBillingAccess(organization);
  const canUsePayg = supportsPayg(subscription);

  if (hasBillingPerms && canUsePayg) {
    openModal(deps => <Modal {...deps} {...options} />, {
      closeEvents: 'escape-key',
      modalCss: theme ? onDemandBudgetEditModalCss(theme) : undefined,
    });
  } else {
    addErrorMessage(
      tct("You don't have permission to edit [budgetTerm] budgets.", {
        budgetTerm: displayBudgetName(subscription.planDetails),
      })
    );
  }
}

const onDemandBudgetEditModalCss = (theme: Theme) => css`
  @media (min-width: ${theme.breakpoints.md}) {
    width: 1000px;
  }
`;

type OpenInvoicePaymentOptions = {
  invoice: Invoice;
  organization: Organization;
  reloadInvoice: () => void;
};

export async function openInvoicePaymentModal(options: OpenInvoicePaymentOptions) {
  const {default: Modal} = await import('getsentry/views/invoiceDetails/paymentForm');

  openModal(deps => <Modal {...deps} {...options} />);
}

type UpsellModalProps = {
  organization: Organization;
  plan: Plan;
  previewData: PreviewData;
  reservations: Reservations;
  subscription: Subscription;
  surface: AM2UpdateSurfaces;
  isActionDisabled?: boolean;
  onComplete?: () => void;
};

export async function openAM2UpsellModal(options: UpsellModalProps) {
  const {default: Modal, modalCss} =
    await import('getsentry/components/upgradeNowModal/index');

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export type UpsellModalSamePriceProps = {
  organization: Organization;
  plan: Plan;
  previewData: PreviewData;
  reservations: Reservations;
  subscription: Subscription;
  surface: AM2UpdateSurfaces;
  onComplete?: () => void;
};

export async function openAM2UpsellModalSamePrice(options: UpsellModalSamePriceProps) {
  const {default: Modal, modalCss} =
    await import('getsentry/components/upgradeNowModal/modalSamePrice');

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type ProfilingUpsellModalProps = {
  organization: Organization;
  subscription: Subscription;
  isActionDisabled?: boolean;
  onComplete?: () => void;
};

export async function openAM2ProfilingUpsellModal(options: ProfilingUpsellModalProps) {
  const {default: Modal, modalCss} =
    await import('getsentry/components/profiling/profilingUpgradeModal');

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openDataConsentModal() {
  const {default: Modal} = await import('getsentry/components/dataConsentModal');

  openModal(deps => <Modal {...deps} />);
}
