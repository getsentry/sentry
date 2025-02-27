import type {ComponentType} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {Client} from 'sentry/api';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {PromotionModalBodyProps} from 'getsentry/components/promotionModal';
import type {Reservations} from 'getsentry/components/upgradeNowModal/types';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {
  Invoice,
  Plan,
  PreviewData,
  Promotion,
  PromotionClaimed,
  Subscription,
} from 'getsentry/types';
import type {AM2UpdateSurfaces} from 'getsentry/utils/trackGetsentryAnalytics';

type UpsellModalOptions = {
  organization: Organization;
  source: string;
  defaultSelection?: string;
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
  const {default: Modal, modalCss} = await import(
    'getsentry/components/trialEndingModal'
  );

  const onClose = genTrialModalOnClose(options, 'trialEnd');

  openModal(deps => <Modal {...deps} {...options} />, {modalCss, onClose});
}

export async function openForcedTrialModal(options: TrialModalProps) {
  const {default: Modal, modalCss} = await import(
    'getsentry/components/forcedTrialModal'
  );

  const onClose = genTrialModalOnClose(options, 'forcedTrial');

  openModal(deps => <Modal {...deps} {...options} />, {
    modalCss,
    onClose,
  });
}

export async function openPartnerPlanEndingModal(options: PartnerPlanModalProps) {
  const {default: Modal, modalCss} = await import(
    'getsentry/components/partnerPlanEndingModal'
  );
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

type EditCreditCardOptions = {
  onSuccess: (data: Subscription) => void;
  organization: Organization;
  location?: Location;
};

export async function openEditCreditCard(options: EditCreditCardOptions) {
  const {default: Modal} = await import('getsentry/components/creditCardEditModal');

  openModal(deps => <Modal {...deps} {...options} />);
}

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
  const {default: Modal, modalCss} = await import(
    'getsentry/components/upgradeNowModal/index'
  );

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
  const {default: Modal, modalCss} = await import(
    'getsentry/components/upgradeNowModal/modalSamePrice'
  );

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type ProfilingUpsellModalProps = {
  organization: Organization;
  subscription: Subscription;
  isActionDisabled?: boolean;
  onComplete?: () => void;
};

export async function openAM2ProfilingUpsellModal(options: ProfilingUpsellModalProps) {
  const {default: Modal, modalCss} = await import(
    'getsentry/components/profiling/profilingUpgradeModal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type PromotionModalOptions = {
  organization: Organization;
  price: number;
  promotion: Promotion;
  promptFeature: string;
  PromotionModalBody?: ComponentType<PromotionModalBodyProps>;
  acceptButtonText?: string;
  api?: Client;
  declineButtonText?: string;
  onAccept?: () => void;
};

export async function openPromotionModal(options: PromotionModalOptions) {
  const {default: Modal, modalCss} = await import('getsentry/components/promotionModal');
  openModal(deps => <Modal {...deps} {...options} />, {closeEvents: 'none', modalCss});
}

export function openPromotionReminderModal(
  promotionClaimed: PromotionClaimed,
  onCancel?: () => void,
  onConfirm?: () => void
) {
  const {dateCompleted} = promotionClaimed;
  const promo = promotionClaimed.promotion;
  const {amount, billingInterval, billingPeriods, maxCentsPerPeriod, reminderText} =
    promo.discountInfo;
  const date = new Date(dateCompleted);
  const percentOff = amount / 100;

  const interval = billingInterval === 'monthly' ? t('months') : t('years');
  const intervalSingular = interval.slice(0, -1);

  /**
   * Removed translation because of complicated pluralization and lots of changing
   * parameters from the different promotions we can use this for
   */

  openConfirmModal({
    message: (
      <div>
        <p>{reminderText}</p>
        <Subheader>{t('Current Promotion:')} </Subheader>
        <p>
          {percentOff}% off (up to ${maxCentsPerPeriod / 100} per {intervalSingular}) for{' '}
          {billingPeriods} {interval} starting on {date.toLocaleDateString('en-US')}
        </p>
      </div>
    ),
    header: <HeaderText>Promotion Conflict</HeaderText>,
    priority: 'danger',
    confirmText: 'Downgrade Anyway',
    onCancel: () => onCancel?.(),
    onConfirm: () => onConfirm?.(),
  });
}

export async function openCodecovModal(options: {organization: Organization}) {
  const {default: Modal, modalCss} = await import(
    'getsentry/components/codecovPromotionModal'
  );
  openModal(deps => <Modal {...deps} {...options} />, {modalCss, closeEvents: 'none'});
}

const HeaderText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
`;

const Subheader = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
`;

export async function openDataConsentModal() {
  const {default: Modal} = await import('getsentry/components/dataConsentModal');

  openModal(deps => <Modal {...deps} />);
}
