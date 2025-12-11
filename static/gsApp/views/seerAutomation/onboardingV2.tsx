import {Fragment} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {useProductBillingAccess} from 'getsentry/hooks/useProductBillingAccess';
import {hasBillingAccess} from 'getsentry/utils/billing';

import {SeerOnboardingProvider} from './onboarding/hooks/seerOnboardingContext';
import {StepsManager} from './onboarding/stepsManager';

export default function SeerOnboardingV2() {
  const organization = useOrganization();
  const hasSeerProduct = useProductBillingAccess(DataCategory.SEER_USER);
  const isAllowedBilling = hasBillingAccess(organization);

  if (!organization.features.includes('seer-new-onboarding')) {
    return <NoAccess />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Seer Setup Wizard')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Set Up Seer')}
        subtitle={t(
          'Follow these steps to configure Seer for your organization. Seer helps automatically analyze and fix issues in your codebase.'
        )}
      />

      {hasSeerProduct ? (
        <NoProjectMessage organization={organization}>
          <SeerOnboardingProvider>
            <StyledGuidedSteps>
              <StepsManager />
            </StyledGuidedSteps>
          </SeerOnboardingProvider>
        </NoProjectMessage>
      ) : isAllowedBilling ? (
        <Alert type="info">
          {tct(
            'Seer is not enabled for your organization. [link:Go to your billing settings] to enable Seer.',
            {
              link: <Link to="/settings/billing/overview/?product=seer" />,
            }
          )}
        </Alert>
      ) : (
        <Alert type="info">
          {t(
            'Your organization does not have access to Seer. Please contact your administrator to enable Seer.'
          )}
        </Alert>
      )}
    </Fragment>
  );
}

const StyledGuidedSteps = styled(GuidedSteps)`
  margin-top: ${p => p.theme.space.xl};
`;
