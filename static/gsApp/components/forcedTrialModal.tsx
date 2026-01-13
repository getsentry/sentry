import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import HighlightModalContainer from 'sentry/components/highlightModalContainer';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Integration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getTrialDaysLeft, getTrialLength} from 'getsentry/utils/billing';

const INTEGRATIONS_TO_CHECK = ['slack'];

interface ForcedTrialModalProps extends Pick<ModalRenderProps, 'closeModal'> {
  organization: Organization;
  subscription: Subscription;
}

function ForcedTrialModal(props: ForcedTrialModalProps) {
  const {organization, subscription, closeModal} = props;
  const hasBillingScope = organization.access.includes('org:billing');
  const {
    data: configurations,
    isPending,
    isError,
  } = useApiQuery<Integration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {
        query: {
          includeConfig: 0,
        },
      },
    ],
    {
      staleTime: 120000,
    }
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  const daysLeft = getTrialDaysLeft(subscription);
  if (daysLeft < 0) {
    return null;
  }

  const disallowedIntegration = (configurations || []).find(config =>
    INTEGRATIONS_TO_CHECK.includes(config.provider.slug)
  );

  const mainHeader = disallowedIntegration
    ? t(
        'Your %s integration will stop working in %s days',
        disallowedIntegration.provider.name,
        daysLeft
      )
    : hasBillingScope
      ? t('Members may lose access to Sentry in %s days', daysLeft)
      : t('You may lose access to Sentry in %s days', daysLeft);

  const firstParagraph = disallowedIntegration
    ? t(
        `Your %s organization is on the Developer plan and does not support the %s integration.`,
        organization.slug,
        disallowedIntegration.provider.name
      )
    : t(
        'Your %s organization is on the Developer plan and does not allow for multiple members.',
        organization.slug
      );

  const secondParagraph = disallowedIntegration ? (
    <Fragment>
      {t(
        'In %s days, your %s integration will be disabled.',
        daysLeft,
        disallowedIntegration.provider.name
      )}{' '}
      {t(
        'Upgrade to our Team or Business plan so you can keep using %s.',
        disallowedIntegration.provider.name
      )}
    </Fragment>
  ) : (
    <Fragment>
      {t('In %s days, your organization will be limited to 1 user.', daysLeft)}{' '}
      {hasBillingScope
        ? t('Upgrade to our Team or Business plan so your members can retain access.')
        : t(
            'Ask your organization owner to upgrade to our Team or Business plan to retain access.'
          )}
    </Fragment>
  );

  // TODO: add explicit check that org has additional members if no restricted integrations

  return (
    <HighlightModalContainer>
      <div>
        <TrialCheckInfo>
          <Subheader>
            {t('%s-day Business Trial', getTrialLength(organization))}
          </Subheader>
          <h2>{mainHeader}</h2>
          <p>{firstParagraph}</p>
          <br />
          <p>{secondParagraph}</p>
        </TrialCheckInfo>
        <StyledButtonBar gap="xl">
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

const TrialCheckInfo = styled('div')`
  padding: ${space(3)} 0;

  p {
    font-size: ${p => p.theme.fontSize.md};
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
  color: ${p => p.theme.tokens.content.accent};
  font-size: ${p => p.theme.fontSize.xs};
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
  max-width: fit-content;
`;

export default withSubscription(ForcedTrialModal);
