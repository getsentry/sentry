import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import FeedbackConfigToggle from 'sentry/components/feedback/feedbackOnboarding/feedbackConfigToggle';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import type {OnboardingLayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {Step, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

export function FeedbackOnboardingLayout({
  cdn,
  docsConfig,
  dsn,
  platformKey,
  projectId,
  projectSlug,
  newOrg,
  configType = 'onboarding',
}: OnboardingLayoutProps) {
  const organization = useOrganization();

  const [email, setEmail] = useState(false);
  const [name, setName] = useState(false);

  const {isLoading: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);
  const selectedOptions = useUrlPlatformOptions(docsConfig.platformOptions);
  const {introduction, steps} = useMemo(() => {
    const doc = docsConfig[configType] ?? docsConfig.onboarding;

    const docParams: DocsParams<any> = {
      cdn,
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
      },
    };

    return {
      introduction: doc.introduction?.(docParams),
      steps: [...doc.install(docParams), ...doc.configure(docParams)],
    };
  }, [
    cdn,
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
                      onEmailToggle={() => setEmail(!email)}
                      onNameToggle={() => setName(!name)}
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
