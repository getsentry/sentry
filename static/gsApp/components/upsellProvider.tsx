import {useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {sendTrialRequest, sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import TrialStarter from 'getsentry/components/trialStarter';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getTrialLength} from 'getsentry/utils/billing';
import trackGetsentryAnalytics, {
  type GetsentryEventKey,
} from 'getsentry/utils/trackGetsentryAnalytics';

type ChildRenderProps = {
  action:
    | 'start_trial'
    | 'send_to_checkout'
    | 'request_trial'
    | 'request_upgrade'
    | 'open_upsell_modal';
  canTrial: boolean;
  defaultButtonText: string;
  hasBillingScope: boolean;
  onClick: (e?: React.MouseEvent) => void;
};

type Props = {
  api: Client;
  children: (opts: ChildRenderProps) => React.ReactNode;
  organization: Organization;
  source: string;
  subscription: Subscription;
  extraAnalyticsParams?: Record<string, any>;
  onTrialStarted?: () => void;
  /**
   * When this is true, a Confirm modal will be displayed before activating the trial
   */
  showConfirmation?: boolean;
  /**
   * if true, non-billing users clicking will trigger trial and plan upgrade requests
   */
  triggerMemberRequests?: boolean;
  upsellDefaultSelection?: string;
};

function LoadingButton(props: {
  defaultOnClick: () => void;
  startTrial: () => Promise<void>;
}) {
  const {startTrial, defaultOnClick} = props;
  const [busy, setBusy] = useState(false);
  return (
    <Button
      autoFocus
      priority="primary"
      busy={busy}
      onClick={async () => {
        setBusy(true);
        await startTrial();
        defaultOnClick();
      }}
    >
      {t('Start Trial')}
    </Button>
  );
}

function UpsellProvider({
  api,
  onTrialStarted,
  organization,
  subscription,
  source,
  extraAnalyticsParams,
  triggerMemberRequests,
  showConfirmation,
  upsellDefaultSelection,
  children,
}: Props) {
  // if the org or subscription isn't loaded yet, don't render anything
  if (!organization || !subscription) {
    return null;
  }
  const hasBillingScope = organization.access?.includes('org:billing');

  // don't render any request trial/upgrade CTAs for non-self serve customers
  if (!hasBillingScope && !subscription.canSelfServe && triggerMemberRequests) {
    return null;
  }

  const canTrial = subscription.canTrial && !subscription.isTrial;
  const handleRequest = () => {
    const args = {
      api,
      organization,
    };
    if (canTrial) {
      return sendTrialRequest(args);
    }
    return sendUpgradeRequest(args);
  };

  let defaultButtonText: string;
  if (hasBillingScope || !triggerMemberRequests) {
    defaultButtonText = canTrial ? t('Start Trial') : t('Upgrade Plan');
  } else {
    defaultButtonText = canTrial ? t('Request Trial') : t('Request Upgrade');
  }

  const getAction = () => {
    if (hasBillingScope) {
      return canTrial ? 'start_trial' : 'send_to_checkout';
    }
    if (triggerMemberRequests) {
      return canTrial ? 'request_trial' : 'request_upgrade';
    }
    return 'open_upsell_modal';
  };

  showConfirmation = showConfirmation && hasBillingScope && canTrial;

  const collectAnalytics = (eventKey: GetsentryEventKey) => {
    trackGetsentryAnalytics(eventKey, {
      source,
      can_trial: canTrial,
      has_billing_scope: hasBillingScope,
      showed_confirmation: !!showConfirmation,
      action: getAction(),
      organization,
      subscription,
      ...extraAnalyticsParams,
    });
  };

  const trialStartProps = {
    organization,
    source,
    onTrialFailed: () => {
      addErrorMessage(t('Error starting trial. Please try again.'));
    },
    onTrialStarted,
  };

  if (showConfirmation) {
    const confirmContent = () => {
      const trialLength = getTrialLength(organization);
      return (
        <div data-test-id="confirm-content">
          {tct(
            `Your organization is about to start a [trialLength]-day free trial. Click confirm to start your trial.`,
            {
              trialLength,
            }
          )}
        </div>
      );
    };
    return (
      <Confirm
        renderMessage={confirmContent}
        onConfirm={() => collectAnalytics('growth.upsell_feature.confirmed')}
        onCancel={() => collectAnalytics('growth.upsell_feature.cancelled')}
        renderConfirmButton={({defaultOnClick}) => (
          <TrialStarter {...trialStartProps}>
            {({startTrial}) => (
              <LoadingButton startTrial={startTrial} defaultOnClick={defaultOnClick} />
            )}
          </TrialStarter>
        )}
        header={<h4>{t('Your trial is about to start')}</h4>}
      >
        {({open}) =>
          children({
            canTrial,
            hasBillingScope,
            defaultButtonText,
            action: getAction(),
            onClick: () => {
              // When the user clicks, open the modal
              collectAnalytics('growth.upsell_feature.clicked');
              open();
            },
          })
        }
      </Confirm>
    );
  }
  return (
    <TrialStarter {...trialStartProps}>
      {({startTrial}) =>
        children({
          canTrial,
          hasBillingScope,
          defaultButtonText,
          action: getAction(),
          onClick: e => {
            e?.preventDefault();
            // Direct start the trial.
            collectAnalytics('growth.upsell_feature.clicked');
            if (hasBillingScope) {
              if (canTrial) {
                startTrial();
              } else {
                // for self-serve can send them to checkout
                const baseUrl = subscription.canSelfServe
                  ? `/settings/${organization.slug}/billing/checkout/`
                  : `/settings/${organization.slug}/billing/overview/`;
                browserHistory.push(`${normalizeUrl(baseUrl)}?referrer=upsell-${source}`);
              }
            } else {
              if (triggerMemberRequests) {
                handleRequest();
              } else {
                openUpsellModal({
                  organization,
                  source,
                  defaultSelection: upsellDefaultSelection,
                });
              }
            }
          },
        })
      }
    </TrialStarter>
  );
}

export default withApi(
  withOrganization(withSubscription(UpsellProvider, {noLoader: true}))
);
