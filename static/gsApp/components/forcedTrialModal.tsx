import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import HighlightModalContainer from 'sentry/components/highlightModalContainer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Integration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getTrialDaysLeft, getTrialLength} from 'getsentry/utils/billing';

const INTEGRATIONS_TO_CHECK = ['slack'];

type Props = Pick<ModalRenderProps, 'closeModal'> &
  DeprecatedAsyncComponent['props'] & {
    organization: Organization;
    subscription: Subscription;
  };

type State = DeprecatedAsyncComponent['state'] & {
  configurations: Integration[] | null;
};

class ForcedTrialModal extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [
      [
        'configurations',
        `/organizations/${organization.slug}/integrations/?includeConfig=0`,
      ],
    ];
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      configurations: null,
    };
  }

  get hasBillingScope() {
    const {organization} = this.props;
    return organization.access.includes('org:billing');
  }

  get getTrialDaysLeft() {
    const {subscription} = this.props;
    return getTrialDaysLeft(subscription);
  }

  get disallowedIntegration() {
    const {configurations} = this.state;
    return (configurations || []).find(config =>
      INTEGRATIONS_TO_CHECK.includes(config.provider.slug)
    );
  }

  get mainHeader() {
    const daysLeft = this.getTrialDaysLeft;
    const configuration = this.disallowedIntegration;
    if (configuration) {
      return t(
        'Your %s integration will stop working in %s days',
        configuration.provider.name,
        daysLeft
      );
    }
    return this.hasBillingScope
      ? t('Members may lose access to Sentry in %s days', daysLeft)
      : t('You may lose access to Sentry in %s days', daysLeft);
  }

  get firstParagraph() {
    const {organization} = this.props;
    const configuration = this.disallowedIntegration;
    if (configuration) {
      return t(
        `Your %s organization is on the Developer plan and does not support the %s integration.`,
        organization.slug,
        configuration.provider.name
      );
    }
    return t(
      `Your %s organization is on the Developer plan and does not allow for multiple members.`,
      organization.slug
    );
  }

  get secondParagraph() {
    const configuration = this.disallowedIntegration;
    if (configuration) {
      return (
        <Fragment>
          {t(
            'In %s days, your %s integration will be disabled.',
            this.getTrialDaysLeft,
            configuration.provider.name
          )}{' '}
          {t(
            'Upgrade to our Team or Business plan so you can keep using %s.',
            configuration.provider.name
          )}
        </Fragment>
      );
    }
    return (
      <Fragment>
        {t(
          'In %s days, your organization will be limited to 1 user.',
          this.getTrialDaysLeft
        )}{' '}
        {this.hasBillingScope
          ? t('Upgrade to our Team or Business plan so your members can retain access.')
          : t(
              'Ask your organization owner to upgrade to our Team or Business plan to retain access.'
            )}
      </Fragment>
    );
  }

  renderBody() {
    const {organization, subscription, closeModal} = this.props;
    const daysLeft = getTrialDaysLeft(subscription);

    if (daysLeft < 0) {
      return null;
    }
    // TODO: add explicit check that org has additional members if no restricted integrations

    const hasBillingScope = organization.access.includes('org:billing');
    return (
      <HighlightModalContainer>
        <div>
          <TrialCheckInfo>
            <Subheader>
              {t('%s-day Business Trial', getTrialLength(organization))}
            </Subheader>
            <h2>{this.mainHeader}</h2>
            <p>{this.firstParagraph}</p>
            <br />
            <p>{this.secondParagraph}</p>
          </TrialCheckInfo>
          <StyledButtonBar gap={2}>
            <UpgradeOrTrialButton
              source="force_trial_modal"
              action="upgrade"
              subscription={subscription}
              organization={organization}
              onSuccess={closeModal}
            >
              {hasBillingScope ? t('Upgrade') : t('Request Upgrade')}
            </UpgradeOrTrialButton>
            <Button data-test-id="maybe-later" priority="default" onClick={closeModal}>
              {t('Continue with Trial')}
            </Button>
          </StyledButtonBar>
        </div>
      </HighlightModalContainer>
    );
  }
}

const TrialCheckInfo = styled('div')`
  padding: ${space(3)} 0;

  p {
    font-size: ${p => p.theme.fontSizeMedium};
    margin: 0;
  }

  h2 {
    font-size: 1.5em;
  }
`;

export const modalCss = css`
  width: 100%;
  max-width: 730px;

  [role='document'] {
    position: relative;
    padding: 70px 80px;
    overflow: hidden;
  }
`;

const Subheader = styled('h4')`
  margin-bottom: ${space(2)};
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
  max-width: fit-content;
`;

export default withSubscription(ForcedTrialModal);
