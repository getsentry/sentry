import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Stack} from 'sentry/components/core/layout';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import type {OnboardingLayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {Step} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import ReplayConfigToggle from 'sentry/components/replaysOnboarding/replayConfigToggle';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function ReplayOnboardingLayout({
  docsConfig,
  dsn,
  platformKey,
  project,
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
      project,
      isLogsSelected: false,
      isFeedbackSelected: false,
      isMetricsSelected: false,
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
    project,
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

  const replayConfigToggle = (
    <ReplayConfigToggle
      blockToggle={block}
      maskToggle={mask}
      onBlockToggle={() => setBlock(!block)}
      onMaskToggle={() => setMask(!mask)}
    />
  );

  return (
    <AuthTokenGeneratorProvider projectSlug={project.slug}>
      <Wrapper>
        {introduction && <Stack margin="0 0 xl 0">{introduction}</Stack>}
        <Stack gap="lg">
          {steps
            // TODO(aknaus): Move inserting the toggle into the docs definitions
            // once the content blocks migration is done. This logic here is very brittle.
            .map(step => {
              if (step.type !== StepType.CONFIGURE || hideMaskBlockToggles) {
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
                    content: replayConfigToggle,
                  });
                }
                return {
                  ...step,
                  content: newContent,
                };
              }

              return {
                ...step,
                codeHeader: replayConfigToggle,
              };
            })
            .map(step => (
              <Step key={step.title ?? step.type} {...step} />
            ))}
        </Stack>
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
