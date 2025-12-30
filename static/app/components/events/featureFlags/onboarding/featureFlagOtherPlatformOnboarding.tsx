import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import OnboardingAdditionalFeatures from 'sentry/components/events/featureFlags/onboarding/onboardingAdditionalFeatures';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

interface FeatureFlagOtherPlatformOnboardingProps {
  integration: string;
  projectSlug: string;
}

export function FeatureFlagOtherPlatformOnboarding({
  projectSlug,
  integration,
}: FeatureFlagOtherPlatformOnboardingProps) {
  const organization = useOrganization();

  const docsUrl =
    integration.toLowerCase() === 'openfeature'
      ? 'https://docs.sentry.io/product/issues/issue-details/feature-flags/#evaluation-tracking'
      : `https://docs.sentry.io/organization/integrations/feature-flag/${integration.toLowerCase()}/#evaluation-tracking`;

  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        {
          <Alert.Container>
            <Alert
              variant="info"
              trailingItems={
                <LinkButton href={docsUrl} size="xs" external>
                  {t('Read the docs')}
                </LinkButton>
              }
            >
              {t('Read the docs to learn more about setting up evaluation tracking.')}
            </Alert>
          </Alert.Container>
        }
        <OnboardingAdditionalFeatures organization={organization} />
      </Wrapper>
    </AuthTokenGeneratorProvider>
  );
}

const Wrapper = styled('div')`
  h4 {
    margin-bottom: 0.5em;
  }
  && {
    p {
      margin-bottom: 0;
    }
    h5 {
      margin-bottom: 0;
    }
  }
`;
