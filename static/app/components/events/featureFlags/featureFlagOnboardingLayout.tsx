import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {Alert} from 'sentry/components/core/alert';
import OnboardingAdditionalInfo from 'sentry/components/events/featureFlags/onboardingAdditionalInfo';
import OnboardingIntegrationSection from 'sentry/components/events/featureFlags/onboardingIntegrationSection';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import type {OnboardingLayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {Step} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface FeatureFlagOnboardingLayoutProps extends OnboardingLayoutProps {
  integration?: string;
  provider?: string;
  skipChangeTracking?: boolean;
  skipEvalTracking?: boolean;
}

export function FeatureFlagOnboardingLayout({
  docsConfig,
  dsn,
  platformKey,
  projectId,
  projectSlug,
  projectKeyId,
  configType = 'onboarding',
  integration = '',
  provider = '',
  skipEvalTracking,
  skipChangeTracking = true,
}: FeatureFlagOnboardingLayoutProps) {
  const api = useApi();
  const organization = useOrganization();
  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);
  const selectedOptions = useUrlPlatformOptions(docsConfig.platformOptions);
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const [hideSteps, setHideSteps] = useState(skipEvalTracking);

  const {steps} = useMemo(() => {
    const doc = docsConfig[configType] ?? docsConfig.onboarding;

    const docParams: DocsParams<any> = {
      api,
      projectKeyId,
      dsn,
      organization,
      platformKey,
      projectId,
      projectSlug,
      isFeedbackSelected: false,
      isPerformanceSelected: false,
      isProfilingSelected: false,
      isReplaySelected: false,
      sourcePackageRegistries: {
        isLoading: isLoadingRegistry,
        data: registryData,
      },
      platformOptions: selectedOptions,
      isSelfHosted,
      urlPrefix,
      featureFlagOptions: {
        integration,
      },
    };

    return {
      steps: [...doc.install(docParams), ...doc.configure(docParams)],
    };
  }, [
    docsConfig,
    dsn,
    isLoadingRegistry,
    organization,
    platformKey,
    projectId,
    projectSlug,
    registryData,
    selectedOptions,
    configType,
    urlPrefix,
    isSelfHosted,
    api,
    projectKeyId,
    integration,
  ]);

  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        {!skipEvalTracking ? null : (
          <Alert.Container>
            <Alert type="info" showIcon>
              <Flex gap={space(3)}>
                {t(
                  'Feature flag integration detected. Please follow the remaining steps.'
                )}
                <Button onClick={() => setHideSteps(!hideSteps)}>
                  {hideSteps ? t('Show Full Guide') : t('Hide Full Guide')}
                </Button>
              </Flex>
            </Alert>
          </Alert.Container>
        )}
        {!hideSteps && (
          <Steps>
            {steps.map(step => (
              <Step key={step.title ?? step.type} {...step} />
            ))}
          </Steps>
        )}
        <Divider />
        {/* If skipChangeTracking, link to settings page instead of displaying the webhook setup form. */}
        {skipChangeTracking ? (
          <OnboardingAdditionalInfo organization={organization} />
        ) : (
          <OnboardingIntegrationSection provider={provider} integration={integration} />
        )}
      </Wrapper>
    </AuthTokenGeneratorProvider>
  );
}

const Steps = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

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

const Divider = styled('div')`
  position: relative;
  margin-top: ${space(3)};
  &:before {
    display: block;
    position: absolute;
    content: '';
    height: 1px;
    left: 0;
    right: 0;
    background: ${p => p.theme.border};
  }
`;
