import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {OnboardingLayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {Step, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {
  PlatformOptionsControl,
  useUrlPlatformOptions,
} from 'sentry/components/onboarding/platformOptionsControl';
import ReplayConfigToggle from 'sentry/components/replaysOnboarding/replayConfigToggle';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

export function ReplayOnboardingLayout({
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
  const [mask, setMask] = useState(true);
  const [block, setBlock] = useState(true);
  const {platformOptions} = docsConfig;
  const {introduction, steps} = useMemo(() => {
    const doc = docsConfig[configType] ?? docsConfig.onboarding;

    const docParams: DocsParams<any> = {
      cdn,
      dsn,
      organization,
      platformKey,
      projectId,
      projectSlug,
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
    mask,
    block,
  ]);

  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        <Header>
          {introduction && <div>{introduction}</div>}
          {platformOptions && !['replayOnboardingJsLoader'].includes(configType) ? (
            <PlatformOptionsControl platformOptions={platformOptions} />
          ) : null}
        </Header>
        <Divider withBottomMargin />
        <Steps>
          {steps.map(step =>
            step.type === StepType.CONFIGURE ? (
              <Step
                key={step.title ?? step.type}
                {...{
                  ...step,
                  codeHeader: (
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

const Header = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const Divider = styled('hr')<{withBottomMargin?: boolean}>`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
  ${p => p.withBottomMargin && `margin-bottom: ${space(3)}`}
`;

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
