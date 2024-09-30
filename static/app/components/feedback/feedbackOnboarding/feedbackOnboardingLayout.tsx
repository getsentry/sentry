import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import FeedbackConfigToggle from 'sentry/components/feedback/feedbackOnboarding/feedbackConfigToggle';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import type {OnboardingLayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {Step, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function FeedbackOnboardingLayout({
  docsConfig,
  dsn,
  platformKey,
  projectId,
  projectSlug,
  newOrg,
  projectKeyId,
  configType = 'onboarding',
}: OnboardingLayoutProps) {
  const api = useApi();
  const organization = useOrganization();

  const [email, setEmail] = useState(false);
  const [name, setName] = useState(false);
  const [screenshot, setScreenshot] = useState(true);

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);
  const selectedOptions = useUrlPlatformOptions(docsConfig.platformOptions);
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const {introduction, steps} = useMemo(() => {
    const doc = docsConfig[configType] ?? docsConfig.onboarding;

    const docParams: DocsParams<any> = {
      api,
      projectKeyId,
      dsn,
      organization,
      platformKey,
      projectId,
      projectSlug,
      isFeedbackSelected: true,
      isPerformanceSelected: false,
      isProfilingSelected: false,
      isReplaySelected: false,
      sourcePackageRegistries: {
        isLoading: isLoadingRegistry,
        data: registryData,
      },
      platformOptions: selectedOptions,
      newOrg,
      feedbackOptions: {
        email,
        name,
        screenshot,
      },
      isSelfHosted,
      urlPrefix,
    };

    return {
      introduction: doc.introduction?.(docParams),
      steps: [...doc.install(docParams), ...doc.configure(docParams)],
    };
  }, [
    docsConfig,
    dsn,
    isLoadingRegistry,
    newOrg,
    organization,
    platformKey,
    projectId,
    projectSlug,
    registryData,
    selectedOptions,
    configType,
    email,
    name,
    screenshot,
    isSelfHosted,
    urlPrefix,
    api,
    projectKeyId,
  ]);

  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        {introduction && <Introduction>{introduction}</Introduction>}
        <Steps>
          {steps.map(step =>
            step.type === StepType.CONFIGURE && configType === 'feedbackOnboardingNpm' ? (
              <Step
                key={step.title ?? step.type}
                {...{
                  ...step,
                  codeHeader: (
                    <FeedbackConfigToggle
                      emailToggle={email}
                      nameToggle={name}
                      screenshotToggle={screenshot}
                      onEmailToggle={() => setEmail(!email)}
                      onNameToggle={() => setName(!name)}
                      onScreenshotToggle={() => setScreenshot(!screenshot)}
                    />
                  ),
                }}
              />
            ) : (
              <Step key={step.title ?? step.type} {...step} />
            )
          )}
        </Steps>
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

const Introduction = styled('div')`
  display: flex;
  flex-direction: column;
  margin-bottom: ${space(4)};
`;
