import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import FeedbackConfigToggle from 'sentry/components/feedback/feedbackOnboarding/feedbackConfigToggle';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import type {OnboardingLayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {Step} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
  project,
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
      project,
      isLogsSelected: false,
      isFeedbackSelected: true,
      isMetricsSelected: false,
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
    project,
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

  const hideFeedbackConfigTogglePlatforms = ['flutter'];
  const hideFeedbackConfigToggle =
    hideFeedbackConfigTogglePlatforms.includes(platformKey);

  const feedbackConfigToggle = (
    <FeedbackConfigToggle
      emailToggle={email}
      nameToggle={name}
      screenshotToggle={screenshot}
      onEmailToggle={() => setEmail(!email)}
      onNameToggle={() => setName(!name)}
      onScreenshotToggle={() => setScreenshot(!screenshot)}
    />
  );

  return (
    <AuthTokenGeneratorProvider projectSlug={project.slug}>
      <Wrapper>
        {introduction && <Introduction>{introduction}</Introduction>}
        <Steps>
          {steps
            // TODO(aknaus): Move inserting the toggle into the docs definitions
            // once the content blocks migration is done. This logic here is very brittle.
            .map(step => {
              if (
                step.type !== StepType.CONFIGURE ||
                configType !== 'feedbackOnboardingNpm' ||
                hideFeedbackConfigToggle
              ) {
                return step;
              }

              if (step.content) {
                // Insert the feedback config toggle before the code block
                const codeIndex = step.content?.findIndex(b => b.type === 'code');
                if (codeIndex === -1) {
                  return step;
                }
                const newContent = [...step.content];
                if (codeIndex !== undefined) {
                  newContent.splice(codeIndex, 0, {
                    type: 'custom',
                    bottomMargin: false,
                    content: feedbackConfigToggle,
                  });
                }
                return {
                  ...step,
                  content: newContent,
                };
              }

              return {
                ...step,
                codeHeader: feedbackConfigToggle,
              };
            })
            .map(step => (
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

const Introduction = styled('div')`
  display: flex;
  flex-direction: column;
  margin-bottom: ${space(4)};
`;
