import {useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import HeroImg from 'getsentry-images/features/replay-modal-hero.jpg';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Plan, Subscription} from 'getsentry/types';
import type {AM2UpdateSurfaces} from 'getsentry/utils/trackGetsentryAnalytics';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

import type {Reservations} from './types';
import useLogUpgradeNowViewed from './useLogUpgradeNowViewed';
import {redirectToManage} from './utils';

type Props = ModalRenderProps & {
  organization: Organization;
  plan: Plan;
  reservations: Reservations;
  subscription: Subscription;
  surface: AM2UpdateSurfaces;
  onComplete?: () => void;
};

function UpgradeNowModal({
  onComplete,
  organization,
  plan,
  reservations,
  subscription,
  surface,
}: Props) {
  useLogUpgradeNowViewed({organization, subscription, surface, hasPriceChange: false});

  const api = useApi();

  const onUpdatePlan = useCallback(async () => {
    try {
      await api.requestPromise(`/customers/${organization.slug}/subscription/`, {
        method: 'PUT',
        data: {
          ...reservations,
          plan: plan.id,
          referrer: 'replay-am2-update-modal',
        },
      });

      SubscriptionStore.loadData(organization.slug, () => {
        if (onComplete) {
          onComplete();
        }

        closeModal();
        addSuccessMessage(t('Subscription Updated!'));

        trackGetsentryAnalytics('upgrade_now.modal.update_now', {
          organization,
          planTier: subscription.planTier,
          canSelfServe: subscription.canSelfServe,
          channel: subscription.channel,
          has_billing_scope: organization.access?.includes('org:billing'),
          surface,
          has_price_change: false,
        });
      });
    } catch (err) {
      Sentry.captureException(err);
      redirectToManage(organization);
      addErrorMessage(
        t(
          'Oops! Unable to update Subscription automatically. Click through to update manually.'
        )
      );
    }
  }, [api, organization, subscription, plan, reservations, onComplete, surface]);

  return (
    <UpsellContent>
      <Subheader>{t('Enable Session Replays Now')}</Subheader>
      <Header>{t('Get to the root cause of an error faster')}</Header>
      <p>
        {t(
          'Enable video-like reproduction of your user sessions so you can see what happened before, during and after an error or performance issue occured.'
        )}
      </p>
      <CTAPanel>
        <div>
          <CTAPrimary>{t('500 replays')}</CTAPrimary>
          <CTASecondary>{t('at no additional cost')}</CTASecondary>
        </div>
        <Button priority="primary" onClick={onUpdatePlan}>
          {t('Enable Now')}
        </Button>
      </CTAPanel>
      <Note>
        {tct(
          'Enabling Session Replay also unlocks [perfAtScale:Performance at Scale] and [profiling:Profiling] at no additional charge. Your existing features will remain unchanged.',
          {
            perfAtScale: (
              <ExternalLink href="https://docs.sentry.io/product/performance/performance-at-scale/" />
            ),
            profiling: <ExternalLink href="https://docs.sentry.io/product/profiling/" />,
          }
        )}
      </Note>
    </UpsellContent>
  );
}

const UpsellContent = styled('div')`
  background: top no-repeat url('${HeroImg}');
  background-size: contain;
  background-position-y: -20px;
  padding-top: 190px;
  margin-inline: -45px;
  padding-inline: 45px;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Subheader = styled('h2')`
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  margin-bottom: ${space(1.5)};
  text-transform: uppercase;
`;

const Header = styled('h1')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: bold;
  margin: ${space(1.5)} 0;
`;

const CTAPanel = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  justify-content: space-between;
  padding: ${space(2)};
  margin-block: ${space(2)};
`;

const CTAPrimary = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
`;
const CTASecondary = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Note = styled('p')`
  text-align: center;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  margin-block: ${space(4)};
`;

export const modalCss = css`
  width: 100%;
  max-width: 532px;

  [role='document'] {
    position: relative;
    padding: 0 45px;
    overflow: hidden;
  }
`;

export default UpgradeNowModal;
