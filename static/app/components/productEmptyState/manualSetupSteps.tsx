import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {OnboardingCopyMarkdownButton} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {StepIndexProvider, TabSelectionScope} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {StepType, type OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

export const EMPTY_STATE_STEP_TITLES: Record<StepType, string> = {
  [StepType.INSTALL]: t('Install Sentry'),
  [StepType.CONFIGURE]: t('Configure Sentry'),
  [StepType.VERIFY]: t('Verify Sentry'),
};

interface ManualSetupStepsProps {
  copyMarkdownSource: string;
  project: Project;
  steps: OnboardingStep[];
}

export function ManualSetupSteps({project, steps, copyMarkdownSource}: ManualSetupStepsProps) {
  const theme = useTheme();

  return (
    <AuthTokenGeneratorProvider projectSlug={project.slug}>
      <TabSelectionScope>
        <StepList>
          {steps.map((step, index) => {
            const title = step.title ?? EMPTY_STATE_STEP_TITLES[step.type ?? StepType.INSTALL];
            return (
              <Grid as="li" key={title} columns="max-content 1fr" gap="xs xl" align="center">
                <Text as="div" size="lg" bold variant="accent">{index + 1}</Text>
                <Flex align="center" justify="between" gap="md">
                  <Heading as="h4" size="lg">{title}</Heading>
                  {index === 0 && (
                    <OnboardingCopyMarkdownButton borderless steps={steps} source={copyMarkdownSource} />
                  )}
                </Flex>
                <Container column="2">
                  <StepIndexProvider index={index}>
                    <ContentBlocksRenderer spacing={theme.space.md} contentBlocks={step.content} />
                  </StepIndexProvider>
                </Container>
              </Grid>
            );
          })}
        </StepList>
      </TabSelectionScope>
    </AuthTokenGeneratorProvider>
  );
}

const StepList = styled('ol')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xl']};
  list-style: none;
  margin: 0;
  padding: 0;
`;
