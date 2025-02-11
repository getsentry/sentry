import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import OnboardingIntegrationSection from 'sentry/components/events/featureFlags/onboardingIntegrationSection';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface FeatureFlagOtherPlatformOnboardingProps {
  projectSlug: string;
  integration?: string;
  provider?: string;
}

export function FeatureFlagOtherPlatformOnboarding({
  projectSlug,
  integration = '',
  provider = '',
}: FeatureFlagOtherPlatformOnboardingProps) {
  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        {
          <Alert type="info" showIcon>
            <Flex gap={space(3)}>
              {t('Read the docs to learn more about setting up the Feature Flags SDK.')}
              <LinkButton
                href={`https://docs.sentry.io/organization/integrations/feature-flag/${provider.toLowerCase()}/#evaluation-tracking/`}
                external
              >
                {t('Read the docs')}
              </LinkButton>
            </Flex>
          </Alert>
        }
        <OnboardingIntegrationSection provider={provider} integration={integration} />
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
