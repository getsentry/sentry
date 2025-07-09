import {Fragment} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import addIntegrationProvider from 'sentry-images/spot/add-integration-provider.svg';
import feedbackOnboardingImg from 'sentry-images/spot/feedback-onboarding.svg';
import onboardingCompass from 'sentry-images/spot/onboarding-compass.svg';
import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import StarFixabilityViewButton from 'sentry/components/events/autofix/seerCreateViewButton';
import {useAutofixRepos} from 'sentry/components/events/autofix/useAutofix';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconChevron, IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {FieldKey} from 'sentry/utils/fields';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import {useStarredIssueViews} from 'sentry/views/nav/secondary/sections/issues/issueViews/useStarredIssueViews';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

interface SeerNoticesProps {
  groupId: string;
  project: Project;
  hasGithubIntegration?: boolean;
}

function CustomStepButtons({
  showBack,
  showNext,
  showSkip,
  onSkip,
  children,
}: {
  showBack: boolean;
  showNext: boolean;
  showSkip: boolean;
  children?: React.ReactNode;
  onSkip?: () => void;
}) {
  return (
    <GuidedSteps.ButtonWrapper>
      {showBack && <GuidedSteps.BackButton />}
      {showNext && <GuidedSteps.NextButton />}
      {showSkip && (
        <Button onClick={onSkip} redesign size="sm">
          {t('Skip for Now')}
        </Button>
      )}
      {children}
    </GuidedSteps.ButtonWrapper>
  );
}

export function SeerNotices({groupId, hasGithubIntegration, project}: SeerNoticesProps) {
  const organization = useOrganization();
  const {repos} = useAutofixRepos(groupId);
  const {preference, isLoading: isLoadingPreferences} =
    useProjectSeerPreferences(project);
  const {starredViews: views} = useStarredIssueViews();

  const detailedProject = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const isAutomationAllowed = organization.features.includes(
    'trigger-autofix-on-issue-summary'
  );
  const prefersStackedNav = usePrefersStackedNav();
  const isStarredViewAllowed = prefersStackedNav;

  const unreadableRepos = repos.filter(repo => repo.is_readable === false);
  const githubRepos = unreadableRepos.filter(repo => repo.provider.includes('github'));
  const nonGithubRepos = unreadableRepos.filter(
    repo => !repo.provider.includes('github')
  );

  // Onboarding conditions
  const needsGithubIntegration = !hasGithubIntegration;
  const needsRepoSelection = repos.length === 0 && !preference?.repositories?.length;
  const needsAutomation =
    detailedProject?.data &&
    (detailedProject?.data?.autofixAutomationTuning === 'off' ||
      detailedProject?.data?.autofixAutomationTuning === undefined ||
      detailedProject?.data?.seerScannerAutomation === false ||
      detailedProject?.data?.seerScannerAutomation === undefined) &&
    isAutomationAllowed;
  const needsFixabilityView =
    !views.some(view => view.query.includes(FieldKey.ISSUE_SEER_ACTIONABILITY)) &&
    isAutomationAllowed &&
    isStarredViewAllowed;

  // Warning conditions
  const hasMultipleUnreadableRepos = unreadableRepos.length > 1;
  const hasSingleUnreadableRepo = unreadableRepos.length === 1;

  // Use localStorage for collapsed state
  const [stepsCollapsed, setStepsCollapsed] = useLocalStorageState(
    `seer-onboarding-collapsed:${project.id}`,
    false
  );

  // Calculate incomplete steps
  const stepConditions = [
    needsGithubIntegration,
    needsRepoSelection,
    needsAutomation,
    needsFixabilityView,
  ];
  const incompleteStepIndices = stepConditions
    .map((needed, idx) => (needed ? idx : null))
    .filter(idx => idx !== null);
  const firstIncompleteIdx = incompleteStepIndices[0];
  const lastIncompleteIdx = incompleteStepIndices[incompleteStepIndices.length - 1];
  const anyStepIncomplete = incompleteStepIndices.length > 0;

  return (
    <NoticesContainer>
      {/* Collapsed summary */}
      {!isLoadingPreferences && anyStepIncomplete && stepsCollapsed && (
        <CollapsedSummaryCard onClick={() => setStepsCollapsed(false)}>
          <IconSeer variant="waiting" size="lg" style={{marginRight: 8}} />
          <span>
            {t(
              'Only %s step%s left to get the most out of Seer.',
              incompleteStepIndices.length,
              incompleteStepIndices.length === 1 ? '' : 's'
            )}
          </span>
          <IconChevron direction="down" style={{marginLeft: 'auto'}} />
        </CollapsedSummaryCard>
      )}
      {/* Full guided steps */}
      {!isLoadingPreferences && anyStepIncomplete && !stepsCollapsed && (
        <AnimatePresence>
          <motion.div
            initial={{opacity: 0, y: 10, height: 0}}
            animate={{opacity: 1, y: 0, height: 'auto'}}
            exit={{opacity: 0, y: 10, height: 0}}
            transition={{duration: 0.2}}
          >
            <StepsHeader>
              <IconSeer variant="waiting" size="xl" />
              Debug Faster with Seer
            </StepsHeader>
            <GuidedSteps>
              {/* Step 1: GitHub Integration */}
              <GuidedSteps.Step
                key="github-setup"
                stepKey="github-setup"
                title={t('Set Up the GitHub Integration')}
                isCompleted={!needsGithubIntegration}
              >
                <StepContentRow>
                  <StepTextCol>
                    <CardDescription>
                      <span>
                        {tct(
                          'Seer is [bold:a lot better] when it has your codebase as context.',
                          {
                            bold: <b />,
                          }
                        )}
                      </span>
                      <span>
                        {tct(
                          'Set up the [integrationLink:GitHub Integration] to allow Seer to find the most accurate root causes, solutions, and code changes for your issues.',
                          {
                            integrationLink: (
                              <ExternalLink
                                href={`/settings/${organization.slug}/integrations/github/`}
                              />
                            ),
                          }
                        )}
                      </span>
                    </CardDescription>
                  </StepTextCol>
                  <StepImageCol>
                    <CardIllustration
                      src={addIntegrationProvider}
                      alt="Add Integration"
                    />
                  </StepImageCol>
                </StepContentRow>
                <CustomStepButtons
                  showBack={false}
                  showNext={firstIncompleteIdx !== 0}
                  showSkip={false}
                >
                  <LinkButton
                    href={`/settings/${organization.slug}/integrations/github/`} redesign
                    size="sm"
                    priority="primary"
                  >
                    {t('Set Up Integration')}
                  </LinkButton>
                </CustomStepButtons>
              </GuidedSteps.Step>

              {/* Step 2: Repo Selection */}
              <GuidedSteps.Step
                key="repo-selection"
                stepKey="repo-selection"
                title={t('Pick Repositories to Work In')}
                isCompleted={!needsRepoSelection}
              >
                <StepContentRow>
                  <StepTextCol>
                    <CardDescription>
                      <span>
                        {t('Select the repos Seer can explore in this project.')}
                      </span>
                      <span>
                        {t(
                          'You can also configure working branches and custom instructions so Seer fits your unique workflow.'
                        )}
                      </span>
                    </CardDescription>
                  </StepTextCol>
                  <StepImageCol>
                    <CardIllustration src={onboardingCompass} alt="Compass" />
                  </StepImageCol>
                </StepContentRow>
                <CustomStepButtons
                  showBack={firstIncompleteIdx !== 1}
                  showNext={lastIncompleteIdx !== 1}
                  showSkip={lastIncompleteIdx === 1}
                  onSkip={() => setStepsCollapsed(true)}
                >
                  <LinkButton
                    to={`/settings/${organization.slug}/projects/${project.slug}/seer/`} redesign
                    size="sm"
                    priority="primary"
                  >
                    {t('Configure Repos')}
                  </LinkButton>
                </CustomStepButtons>
              </GuidedSteps.Step>

              {/* Step 3: Unleash Automation */}
              {isAutomationAllowed && (
                <GuidedSteps.Step
                  key="unleash-automation"
                  stepKey="unleash-automation"
                  title={t('Unleash Automation')}
                  isCompleted={!needsAutomation}
                >
                  <StepContentRow>
                    <StepTextCol>
                      <CardDescription>
                        <span>
                          {t(
                            'Let Seer automatically deep dive into incoming issues, so you wake up to solutions, not headaches.'
                          )}
                        </span>
                      </CardDescription>
                    </StepTextCol>
                    <StepImageCol>
                      <CardIllustration
                        src={waitingForEventImg}
                        alt="Waiting for Event"
                      />
                    </StepImageCol>
                  </StepContentRow>
                  <CustomStepButtons
                    showBack={firstIncompleteIdx !== 2}
                    showNext={lastIncompleteIdx !== 2}
                    showSkip={lastIncompleteIdx === 2}
                    onSkip={() => setStepsCollapsed(true)}
                  >
                    <LinkButton
                      to={`/settings/${organization.slug}/projects/${project.slug}/seer/`} redesign
                      size="sm"
                      priority="primary"
                    >
                      {t('Enable Automation')}
                    </LinkButton>
                  </CustomStepButtons>
                </GuidedSteps.Step>
              )}

              {/* Step 4: Fixability View */}
              {isAutomationAllowed && isStarredViewAllowed && (
                <GuidedSteps.Step
                  key="fixability-view"
                  stepKey="fixability-view"
                  title={t('Get Some Quick Wins')}
                  isCompleted={!needsFixabilityView}
                >
                  <StepContentRow>
                    <StepTextCol>
                      <CardDescription>
                        <span>
                          {t(
                            'Seer scans all your issues and highlights the ones that are likely quick to fix.'
                          )}
                        </span>
                        <span>
                          {t(
                            'Star the recommended issue view to keep an eye on quick debugging opportunities. You can customize the view later.'
                          )}
                        </span>
                      </CardDescription>
                    </StepTextCol>
                    <StepImageCol>
                      <CardIllustration src={feedbackOnboardingImg} alt="Feedback" />
                    </StepImageCol>
                  </StepContentRow>
                  <CustomStepButtons
                    showBack={firstIncompleteIdx !== 3}
                    showNext={lastIncompleteIdx !== 3}
                    showSkip={lastIncompleteIdx === 3}
                    onSkip={() => setStepsCollapsed(true)}
                  >
                    <StarFixabilityViewButton
                      isCompleted={!needsFixabilityView}
                      project={project}
                    />
                  </CustomStepButtons>
                </GuidedSteps.Step>
              )}
            </GuidedSteps>
            <StepsDivider />
          </motion.div>
        </AnimatePresence>
      )}
      {/* Banners for unreadable repos */}
      {hasMultipleUnreadableRepos && (
        <StyledAlert type="warning" showIcon key="multiple-repos">
          {tct("Seer can't access these repositories: [repoList].", {
            repoList: <b>{unreadableRepos.map(repo => repo.name).join(', ')}</b>,
          })}
          {githubRepos.length > 0 && (
            <Fragment>
              {' '}
              {tct(
                'For best performance, enable the [integrationLink:GitHub integration].',
                {
                  integrationLink: (
                    <ExternalLink
                      href={`/settings/${organization.slug}/integrations/github/`}
                    />
                  ),
                }
              )}
            </Fragment>
          )}
          {nonGithubRepos.length > 0 && (
            <Fragment> {t('Seer currently only supports GitHub repositories.')}</Fragment>
          )}
        </StyledAlert>
      )}
      {hasSingleUnreadableRepo && (
        <StyledAlert type="warning" showIcon key="single-repo">
          {unreadableRepos[0]?.provider.includes('github')
            ? tct(
                "Seer can't access the [repo] repository, make sure the [integrationLink:GitHub integration] is correctly set up.",
                {
                  repo: <b>{unreadableRepos[0]?.name}</b>,
                  integrationLink: (
                    <ExternalLink
                      href={`/settings/${organization.slug}/integrations/github/`}
                    />
                  ),
                }
              )
            : tct(
                "Seer can't access the [repo] repository. It currently only supports GitHub repositories.",
                {repo: <b>{unreadableRepos[0]?.name}</b>}
              )}
        </StyledAlert>
      )}
    </NoticesContainer>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(2)};
`;

const NoticesContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

const CardDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const CardIllustration = styled('img')`
  width: 100%;
  max-width: 200px;
  min-width: 100px;
  height: auto;
  object-fit: contain;
  margin-bottom: -6px;
  margin-right: 10px;
`;

const StepContentRow = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: ${space(3)};
`;

const StepTextCol = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  flex: 0 0 75%;
  min-width: 0;
`;

const StepImageCol = styled('div')`
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  flex-grow: 1;
`;

const StepsHeader = styled('h3')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: ${space(0.5)};
  margin-left: 1px;
`;

const StepsDivider = styled('hr')`
  border: none;
  border-top: 1px solid ${p => p.theme.border};
  margin: ${space(3)} 0;
`;

const CollapsedSummaryCard = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  background: ${p => p.theme.pink400}10;
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  padding: ${space(1)};
  margin-bottom: ${space(2)};
  cursor: pointer;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 500;
  color: ${p => p.theme.textColor};
  transition: box-shadow 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  &:hover {
    background: ${p => p.theme.pink400}20;
  }
`;
