import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import HighlightModalContainer from 'sentry/components/highlightModalContainer';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getTrialDaysLeft, getTrialLength, hasPerformance} from 'getsentry/utils/billing';

import Details from './details';

type Props = ModalRenderProps & {
  organization: Organization;
  source: string;
  subscription: Subscription;
};

function UpsellModal({source, organization, subscription}: Props) {
  const canTrial = subscription.canTrial && !subscription.isTrial;
  const headerMessage = subscription.isTrial ? (
    <div>
      <Subheader>
        {tn(
          'Trial Active - %s Day Left',
          'Trial Active - %s Days Left',
          getTrialDaysLeft(subscription)
        )}
      </Subheader>
      <Header>{t('Your trial is currently active')}</Header>
    </div>
  ) : hasPerformance(subscription.planDetails) ? (
    <div>
      <Subheader>
        {canTrial
          ? t('%s-day Business Trial', getTrialLength(organization))
          : t('Next stop - Business Plan')}
      </Subheader>
      <Header>{t('Try the upgrade. Regret less.')}</Header>
    </div>
  ) : (
    <div>
      <Subheader>
        {canTrial
          ? t('%s-day Performance Trial', getTrialLength(organization))
          : t("But wait there's more")}
      </Subheader>
      <Header>{t('Get a Performance Boost')}</Header>
    </div>
  );

  return (
    <HighlightModalContainer>
      <div data-test-id="try-business-modal">
        {headerMessage}
        <Details
          source={source}
          subscription={subscription}
          organization={organization}
          onCloseModal={() => closeModal()}
        />
      </div>
    </HighlightModalContainer>
  );
}

const Header = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: bold;
  margin: ${space(1)} 0;
`;

const Subheader = styled('div')`
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export const modalCss = css`
  width: 100%;
  max-width: 980px;

  [role='document'] {
    position: relative;
    padding: 70px 80px;
    overflow: hidden;
  }
`;

export default withSubscription(UpsellModal);
