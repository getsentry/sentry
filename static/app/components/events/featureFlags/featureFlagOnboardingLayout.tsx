import {useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import OnboardingAdditionalFeatures from 'sentry/components/events/featureFlags/onboardingAdditionalFeatures';
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
  integration: string;
}

export function FeatureFlagOnboardingLayout({
  docsConfig,
  dsn,
  platformKey,
  projectId,
  projectSlug,
  projectKeyId,
  configType = 'onboarding',
  integration,
}: FeatureFlagOnboardingLayoutProps) {
  const api = useApi();
  const organization = useOrganization();
  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);
  const selectedOptions = useUrlPlatformOptions(docsConfig.platformOptions);
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);

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
        <Steps>
          {steps.map(step => (
            <Step key={step.title ?? step.type} {...step} />
          ))}
          <StyledLinkButton to="/issues/" priority="primary">
            {t('Take me to Issues')}
          </StyledLinkButton>
        </Steps>
        <Divider />
        <OnboardingAdditionalFeatures organization={organization} />
      </Wrapper>
    </AuthTokenGeneratorProvider>
  );
}

const Steps = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const StyledLinkButton = styled(LinkButton)`
  align-self: flex-start;
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
