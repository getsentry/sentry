import {useTheme} from '@emotion/react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {
  StepIndexProvider,
  TabSelectionScope,
} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {
  StepType,
  type OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

const EMPTY_STATE_STEP_TITLES: Record<StepType, string> = {
  [StepType.INSTALL]: t('Install Sentry'),
  [StepType.CONFIGURE]: t('Configure Sentry'),
  [StepType.VERIFY]: t('Verify Sentry'),
};

interface ManualSetupStepsProps {
  project: Project;
  steps: OnboardingStep[];
}

export function ManualSetupSteps({project, steps}: ManualSetupStepsProps) {
  const theme = useTheme();

  return (
    <AuthTokenGeneratorProvider projectSlug={project.slug}>
      <TabSelectionScope>
        <Stack as="ol" role="list" gap="2xl" padding="0" margin="0">
          {steps.map((step, index) => {
            const title =
              step.title ?? EMPTY_STATE_STEP_TITLES[step.type ?? StepType.INSTALL];
            return (
              <Grid
                as="li"
                key={title}
                columns="max-content 1fr"
                gap="xs xl"
                align="center"
              >
                <Text as="div" size="lg" bold variant="accent">
                  {index + 1}
                </Text>
                <Flex align="center" minHeight={theme.form.xs.height}>
                  <Heading as="h4" size="lg">
                    {title}
                  </Heading>
                </Flex>
                <Container column="2">
                  <StepIndexProvider index={index}>
                    <ContentBlocksRenderer
                      spacing={theme.space.md}
                      contentBlocks={step.content}
                    />
                  </StepIndexProvider>
                </Container>
              </Grid>
            );
          })}
        </Stack>
      </TabSelectionScope>
    </AuthTokenGeneratorProvider>
  );
}
