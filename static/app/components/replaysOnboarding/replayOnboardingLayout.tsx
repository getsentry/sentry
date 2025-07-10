import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import type {OnboardingLayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {Step, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import ReplayConfigToggle from 'sentry/components/replaysOnboarding/replayConfigToggle';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function ReplayOnboardingLayout({
  docsConfig,
  dsn,
  platformKey,
  projectId,
  projectSlug,
  newOrg,
  projectKeyId,
  configType = 'onboarding',
  hideMaskBlockToggles,
}: OnboardingLayoutProps & {hideMaskBlockToggles?: boolean}) {
  const api = useApi();
  const organization = useOrganization();
  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);
  const selectedOptions = useUrlPlatformOptions(docsConfig.platformOptions);
  const [mask, setMask] = useState(true);
  const [block, setBlock] = useState(true);
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
      isFeedbackSelected: false,
      isPerformanceSelected: false,
      isProfilingSelected: false,
      isReplaySelected: true,
      sourcePackageRegistries: {
        isLoading: isLoadingRegistry,
        data: registryData,
      },
      platformOptions: selectedOptions,
      newOrg,
      replayOptions: {
        mask,
        block,
      },
      isSelfHosted,
      urlPrefix,
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
    mask,
    block,
    urlPrefix,
    isSelfHosted,
    api,
    projectKeyId,
  ]);

  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        {introduction && <Introduction>{introduction}</Introduction>}
        <Steps>
          {steps.map(step =>
            step.type === StepType.CONFIGURE ? (
              <Step
                key={step.title ?? step.type}
                {...{
                  ...step,
                  codeHeader: hideMaskBlockToggles ? null : (
                    <ReplayConfigToggle
                      blockToggle={block}
                      maskToggle={mask}
                      onBlockToggle={() => setBlock(!block)}
                      onMaskToggle={() => setMask(!mask)}
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
  margin: 0 0 ${space(2)} 0;
`;
