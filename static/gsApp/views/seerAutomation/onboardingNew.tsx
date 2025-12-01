import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCheckmark, IconGithub} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository} from 'sentry/types/integrations';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {CodeReviewRepositorySelector} from './onboarding/codeReviewRepositorySelector';
import {RepositorySelector} from './onboarding/repositorySelector';
import {RepositoryToProjectConfiguration} from './onboarding/repositoryToProjectConfiguration';

export default function SeerOnboardingNew() {
  const organization = useOrganization();
  const [selectedRepositories, setSelectedRepositories] = useState<Repository[]>([]);

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Setup Wizard')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Set Up Seer')}
        subtitle={t(
          'Follow these steps to configure Seer for your organization. Seer helps automatically analyze and fix issues in your codebase.'
        )}
      />

      <NoProjectMessage organization={organization}>
        <StyledGuidedSteps>
          {/* Step 1: Connect GitHub */}
          <GuidedSteps.Step stepKey="connect-github" title={t('Connect GitHub')}>
            <StepContent>
              <MaxWidthPanel>
                <PanelBody withPadding>
                  <p>
                    {t(
                      'In order to get the most out of Sentry and use Seer we will need to access your code repositories in GitHub. (We do not currently support Gitlab, Bitbucket, or others)'
                    )}
                  </p>
                  <ActionSection>
                    <LinkButton
                      priority="primary"
                      size="md"
                      icon={<IconGithub />}
                      to={`/settings/${organization.slug}/integrations/github/`}
                    >
                      {t('Connect GitHub')}
                    </LinkButton>
                  </ActionSection>
                  <GuidedSteps.ButtonWrapper>
                    <GuidedSteps.BackButton size="md" />
                    <GuidedSteps.NextButton size="md" />
                  </GuidedSteps.ButtonWrapper>
                </PanelBody>
              </MaxWidthPanel>
            </StepContent>
          </GuidedSteps.Step>

          {/* Step 2: Connect Repos */}
          <GuidedSteps.Step stepKey="connect-repos" title={t('Connect Repos')}>
            <StepContent>
              <MaxWidthPanel>
                <PanelBody>
                  <PanelDescription>
                    <p>{t(`You successfully connected to GitHub!`)}</p>

                    <p>
                      {t(`
Next, select repos you would want to have Seer run on — this is important for AI Code Review, as well as giving Seer more context into your codebase to offer better Root Cause Analysis in the Issue Stream.
`)}
                    </p>
                  </PanelDescription>
                  <RepositorySelector
                    selectedRepositories={selectedRepositories}
                    onSelectionChange={setSelectedRepositories}
                  />
                </PanelBody>
              </MaxWidthPanel>

              <GuidedSteps.ButtonWrapper>
                <GuidedSteps.BackButton size="md" />
                <GuidedSteps.NextButton size="md" />
              </GuidedSteps.ButtonWrapper>
            </StepContent>
          </GuidedSteps.Step>

          {/* Step 3: Configure Repos */}
          <GuidedSteps.Step stepKey="configure-repos" title={t('Configure Repos')}>
            <StepContent>
              <MaxWidthPanel>
                <PanelBody>
                  <PanelDescription>
                    <p>
                      {t(
                        'Pull Request Code Review is managed at the level of the individual repository. Decide which repos you want Seer to review the code for.'
                      )}
                    </p>
                  </PanelDescription>

                  <CodeReviewRepositorySelector repositories={selectedRepositories} />
                </PanelBody>
              </MaxWidthPanel>
            </StepContent>

            <GuidedSteps.ButtonWrapper>
              <GuidedSteps.BackButton size="md" />
              <GuidedSteps.NextButton size="md" />
            </GuidedSteps.ButtonWrapper>
          </GuidedSteps.Step>

          {/* Step 4: Connect & Configure Projects */}
          <GuidedSteps.Step
            stepKey="connect-configure-projects"
            title={t('Connect & Configure Projects')}
          >
            <StepContent>
              <MaxWidthPanel>
                <PanelBody>
                  <PanelDescription>
                    <p>
                      {t(
                        'Pair your projects with your repositories to enable Seer to analyze your codebase.'
                      )}
                    </p>
                  </PanelDescription>

                  <RepositoryToProjectConfiguration repositories={selectedRepositories} />
                </PanelBody>
              </MaxWidthPanel>
            </StepContent>

            <GuidedSteps.ButtonWrapper>
              <GuidedSteps.BackButton size="md" />
              <GuidedSteps.NextButton size="md" />
            </GuidedSteps.ButtonWrapper>
          </GuidedSteps.Step>

          {/* Step 5: Next Steps */}
          <GuidedSteps.Step stepKey="next-steps" title={t('Next Steps')}>
            <StepContent>
              <SuccessMessage>
                <IconCheckmark size="lg" color="successText" />
                <div>
                  <strong>{t('Setup Complete!')}</strong>
                  <p>
                    {t(
                      `Seer is now configured for your organization. Here's what happens next:`
                    )}
                  </p>
                </div>
              </SuccessMessage>

              <NextStepsList>
                <li>{t('Seer will automatically analyze new issues as they come in')}</li>
                <li>{t('You can manually trigger Seer from any issue detail page')}</li>
                <li>
                  {t(
                    'Review and merge pull requests created by Seer in your repositories'
                  )}
                </li>
                <li>
                  {tct(`Monitor Seer's activity in your [link:organization settings]`, {
                    link: <ExternalLink href={`/settings/${organization.slug}/seer/`} />,
                  })}
                </li>
              </NextStepsList>

              <ActionSection>
                <LinkButton
                  priority="primary"
                  size="md"
                  to={`/organizations/${organization.slug}/issues/`}
                >
                  {t('View Issues')}
                </LinkButton>
                <LinkButton size="md" to={`/settings/${organization.slug}/seer/`}>
                  {t('Go to Seer Settings')}
                </LinkButton>
              </ActionSection>
            </StepContent>

            <GuidedSteps.ButtonWrapper>
              <GuidedSteps.BackButton size="md" />
            </GuidedSteps.ButtonWrapper>
          </GuidedSteps.Step>
        </StyledGuidedSteps>
      </NoProjectMessage>
    </Fragment>
  );
}

const StyledGuidedSteps = styled(GuidedSteps)`
  margin-top: ${space(2)};
`;

const StepContent = styled('div')`
  margin-top: ${space(1.5)};
  margin-bottom: ${space(2)};

  p {
    margin-bottom: ${space(1.5)};
    line-height: 1.6;
  }

  p:last-of-type {
    margin-bottom: 0;
  }
`;

const ActionSection = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  gap: ${space(1)};
`;

const SuccessMessage = styled('div')`
  display: flex;
  align-items: start;
  gap: ${space(1.5)};
  padding: ${space(2)};
  background: ${p => p.theme.successBackground};
  border: 1px solid ${p => p.theme.success};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};

  svg {
    flex-shrink: 0;
    margin-top: ${space(0.25)};
  }

  strong {
    display: block;
    color: ${p => p.theme.successText};
    font-size: ${p => p.theme.fontSize.md};
    margin-bottom: ${space(0.5)};
  }

  p {
    margin: 0;
    color: ${p => p.theme.textColor};
    font-size: ${p => p.theme.fontSize.sm};
  }
`;

const NextStepsList = styled('ul')`
  list-style: disc;
  padding-left: ${space(3)};
  margin: ${space(2)} 0;

  li {
    margin-bottom: ${space(1)};
    color: ${p => p.theme.textColor};
    font-size: ${p => p.theme.fontSize.sm};
    line-height: 1.6;

    &:last-child {
      margin-bottom: 0;
    }
  }
`;

const MaxWidthPanel = styled(Panel)`
  max-width: 600px;
`;

const PanelDescription = styled('div')`
  padding: ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;
