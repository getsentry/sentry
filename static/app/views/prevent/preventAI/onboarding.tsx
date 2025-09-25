import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import preventHero from 'sentry-images/features/prevent-hero.svg';
import preventPrCommentsDark from 'sentry-images/features/prevent-pr-comments-dark.svg';
import preventPrCommentsLight from 'sentry-images/features/prevent-pr-comments-light.svg';

import {Alert} from 'sentry/components/core/alert';
import {Container, Flex} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {Heading} from 'sentry/components/core/text/heading';
import {IconInfo} from 'sentry/icons/iconInfo';
import {t, tct} from 'sentry/locale';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import useOrganization from 'sentry/utils/useOrganization';

interface OnboardingStepProps {
  description: React.ReactNode;
  step: number;
  title: string;
}

function OnboardingStep({step, title, description}: OnboardingStepProps) {
  return (
    <Flex gap="md" align="start" position="relative">
      <StepNumber>{step}</StepNumber>
      <StepContent isLastStep={step === 3}>
        <Flex direction="column" gap="md">
          <Heading as="h3">{title}</Heading>
          <Text variant="muted" size="md">
            {description}
          </Text>
        </Flex>
      </StepContent>
    </Flex>
  );
}

export function FeatureOverview() {
  return (
    <Flex direction="column" gap="md" padding="xl" background="secondary" radius="md">
      <Text variant="primary" size="md" bold>
        {t('How to use AI Code Review')}
      </Text>
      <Text variant="muted" size="md">
        {t('AI Code Review helps you ship better code with three features:')}
      </Text>
      <Container as="ul" style={{margin: 0, fontSize: '12px'}}>
        <li>
          <Text variant="muted" size="sm">
            {tct(
              'It reviews your code, suggesting broader fixes when you prompt [sentryCommand].',
              {
                sentryCommand: (
                  <Text variant="accent" size="sm" bold>
                    @sentry review
                  </Text>
                ),
              }
            )}
          </Text>
        </li>
        <li>
          <Text variant="muted" size="sm">
            {tct(
              'It predicts which errors your code will cause. This happens automatically when you mark a PR ready for review, and when you trigger a PR review with [sentryCommand].',
              {
                sentryCommand: (
                  <Text variant="accent" size="sm" bold>
                    @sentry review
                  </Text>
                ),
              }
            )}
          </Text>
        </li>
        <li>
          <Text variant="muted" size="sm">
            {tct('It generates unit tests for your PR when you prompt [sentryCommand].', {
              sentryCommand: (
                <Text variant="accent" size="sm" bold>
                  @sentry generate-test
                </Text>
              ),
            })}
          </Text>
        </li>
      </Container>
      <Text variant="muted" size="xs">
        {tct(
          'Sentry Error Prediction works better with Sentry Issue Context. [link:Learn more] on how to set this up to get the most accurate error prediction we can offer.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/sentry-prevent-ai/" />
            ),
          }
        )}
      </Text>
    </Flex>
  );
}

export default function PreventAIOnboarding() {
  const organization = useOrganization();
  const theme = useTheme();
  const regionData = getRegionDataFromOrganization(organization);
  const isUSOrg = regionData?.name === 'us';
  return (
    <Flex direction="column" gap="2xl">
      {!isUSOrg && (
        <Container maxWidth="1000px">
          <Alert.Container>
            <Alert type="info">
              {t(
                'AI Code Review data is stored in the U.S. only and is not available in the EU. EU region support is coming soon.'
              )}
            </Alert>
          </Alert.Container>
        </Container>
      )}
      <Flex
        direction="row"
        gap="md"
        justify="around"
        border="primary"
        radius="md"
        padding="xl 2xl"
        maxWidth="1000px"
      >
        <StyledImg src={preventHero} alt="AI Code Review Hero" />
        <Flex direction="column" gap="md" maxWidth="500px" padding="2xl 0">
          <Heading as="h1" style={{maxWidth: '400px'}}>
            {t('Ship Code That Breaks Less With Code Reviews And Tests')}
          </Heading>
          <Text variant="primary" size="md">
            {t('AI Code Review is an AI agent that automates tasks in your PR:')}
          </Text>
          <Container as="ul" style={{margin: 0, fontSize: '12px'}}>
            <Container as="li">
              {t(
                'It reviews your pull requests, predicting errors and suggesting code fixes.'
              )}
            </Container>
            <Container as="li">
              {t('It generates unit tests for untested code in your PR.')}
            </Container>
          </Container>
        </Flex>
      </Flex>
      <Flex
        direction="row"
        gap="md"
        border="primary"
        radius="md"
        padding="xl 2xl"
        maxWidth="1000px"
      >
        <Flex direction="column" gap="2xl" maxWidth="600px">
          <Flex
            direction="column"
            gap="lg"
            padding="0 0 xl 0"
            style={{borderBottom: `1px solid ${theme.border}`}}
          >
            <Heading as="h1">{t('Setup AI Code Review')}</Heading>
            <Text variant="primary" size="sm">
              {t(
                `These setups must be installed or approved by an admin. If you're not an admin, reach out to your organization's admins to ensure they approve the installation.`
              )}
            </Text>
          </Flex>
          <Flex direction="column" gap="xl">
            <OnboardingStep
              step={1}
              title={t(`Enable AI Code Review features`)}
              description={tct(
                'An organization admin needs to turn on two toggles: [enablePreventAI] and [showGenerativeAI] in your [organizationSettingsLink:organization settings].',
                {
                  enablePreventAI: (
                    <Text italic variant="muted" size="md">
                      Enable AI Code Review
                    </Text>
                  ),
                  showGenerativeAI: (
                    <Text italic variant="muted" size="md">
                      Show Generative AI Features
                    </Text>
                  ),
                  organizationSettingsLink: (
                    <Link to={`/settings/${organization.slug}/#hideAiFeatures`} />
                  ),
                }
              )}
            />
            <OnboardingStep
              step={2}
              title={t(`Setup GitHub Integration`)}
              description={tct(
                'To grant Seer access to your codebase, install the [sentryGitHubApp:Sentry GitHub App] to connect your GitHub repositories. Learn more about [gitHubIntegration:GitHub integration].',
                {
                  sentryGitHubApp: (
                    <Link to={`/settings/${organization.slug}/integrations/github/`} />
                  ),
                  gitHubIntegration: (
                    <ExternalLink href="https://docs.sentry.io/organization/integrations/source-code-mgmt/github/#installing-github" />
                  ),
                }
              )}
            />
            <OnboardingStep
              step={3}
              title={t(`Setup Seer`)}
              description={tct(
                'AI Code Review uses the Sentry Seer agent to power its core functionalities. Install the [link:Seer by Sentry GitHub App] within the same GitHub organization.',
                {
                  link: <ExternalLink href="https://github.com/apps/seer-by-sentry" />,
                }
              )}
            />
          </Flex>
          <FeatureOverview />
          <Text variant="muted" size="xs">
            <Flex gap="sm" justify="center">
              <IconInfo size="xs" />
              {t(
                `This page will remain visible after the app is installed. Reviewer Configuration and Usage Stats are coming soon.`
              )}
            </Flex>
          </Text>
        </Flex>
        <StyledImg
          src={theme.type === 'dark' ? preventPrCommentsDark : preventPrCommentsLight}
          alt="Prevent PR Comments"
        />
      </Flex>
    </Flex>
  );
}

const StyledImg = styled('img')`
  overflow: hidden;
  height: 100%;
  max-width: 40%;
  align-self: center;
`;

const StepNumber = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: ${p => p.theme.purple300};
  color: ${p => p.theme.white};
  border-radius: 50%;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
`;

const StepContent = styled('div')<{isLastStep?: boolean}>`
  flex: 1;
  position: relative;

  /* This is for the gray line that connects the steps */
  &::before {
    content: '';
    position: absolute;
    left: -20px;
    top: 25px;
    bottom: ${p => (p.isLastStep ? '0px' : '-20px')};
    width: 2px;
    background-color: ${p => p.theme.border};
    z-index: 0;
  }
`;
