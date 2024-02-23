import {useMemo} from 'react';
import styled from '@emotion/styled';

import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import type {OnboardingLayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {Step} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
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
  const {isLoading: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);
  const selectedOptions = useUrlPlatformOptions(docsConfig.platformOptions);
  const {steps} = useMemo(() => {
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
    };

    return {
      introduction: doc.introduction?.(docParams),
      steps: [
        ...doc.install(docParams),
        ...doc.configure(docParams),
        ...doc.verify(docParams),
      ],
      nextSteps: doc.nextSteps?.(docParams) || [],
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
  ]);

  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        <Steps>
          {steps.map(step => (
            <Step key={step.title ?? step.type} {...step} />
          ))}
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
