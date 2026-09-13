import {Fragment, useState} from 'react';

import seerConfigBug1 from 'sentry-images/spot/seer-config-bug-1.svg';
import seerConfigCheck from 'sentry-images/spot/seer-config-check.svg';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import type {
  SeerOnboardingActions,
  SeerOnboardingProject,
  SeerOnboardingState,
  SeerRepoLink,
} from 'sentry/components/seer/onboarding/types';
import {
  getLinkedProjects,
  willOpenPullRequests,
} from 'sentry/components/seer/onboarding/types';
import {IconAdd, IconChevron, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useStoppingPointSelectOptions} from 'sentry/utils/seer/stoppingPoint';
import type {SeerAutofixStoppingPoint} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

const AUTOFIX_DOCS = 'https://docs.sentry.io/product/ai-in-sentry/seer/autofix/';
const AUTOMATION_DOCS = `${AUTOFIX_DOCS}#how-issue-autofix-works`;
const CODE_GENERATION_DOCS = `${AUTOFIX_DOCS}#code-generation`;
const AI_FEATURES_DOCS =
  'https://docs.sentry.io/product/ai-in-sentry/#ai-powered-features';

interface StepProps {
  actions: SeerOnboardingActions;
  state: SeerOnboardingState;
}

/**
 * The user-facing stopping point the modal is steering towards. Only this value
 * produces a pull request from an automated run.
 */
const PR_STOPPING_POINT = 'create_pr';

/**
 * `useStoppingPointSelectOptions` speaks the backend vocabulary; the modal (and
 * `SeerOnboardingState`) speaks the user-facing one. Both name the same four
 * choices, so map between them rather than duplicating the option list.
 */
function toUserFacing(value: SeerAutofixStoppingPoint) {
  switch (value) {
    case 'root_cause':
      return 'root_cause' as const;
    case 'solution':
    case 'code_changes':
      return 'plan' as const;
    case 'open_pr':
      return PR_STOPPING_POINT;
    default:
      return 'off' as const;
  }
}

/**
 * Every step configures something the user can revisit. Saying so — and linking
 * straight at it — keeps the modal from feeling like a one-shot decision.
 *
 * Rendered below the step's buttons so it reads as a footnote rather than
 * splitting the actions apart.
 *
 * The `#fieldName` anchors are honoured by the form system: `useScrollToHash`
 * in `core/form/field/baseField.tsx` scrolls to, focuses and highlights the
 * matching field.
 */
function SettingsHint({children}: {children: React.ReactNode}) {
  return (
    <Text as="p" size="sm" variant="muted">
      {children}
    </Text>
  );
}

function StepDescription({children}: {children: React.ReactNode}) {
  return (
    <Text as="p" variant="muted">
      {children}
    </Text>
  );
}

function EnableAiStep({actions, state}: StepProps) {
  return (
    <Stack gap="lg" align="start">
      <StepDescription>
        {tct(
          'Seer is part of your plan, but generative AI features are turned off for this organization. Read more about [ai:generative AI features] in the docs.',
          {ai: <ExternalLink href={AI_FEATURES_DOCS} />}
        )}
      </StepDescription>
      {state.canWriteOrgSettings ? (
        <Button variant="primary" size="sm" onClick={actions.enableAiFeatures}>
          {t('Enable Generative AI Features')}
        </Button>
      ) : (
        <Alert variant="warning">
          {t(
            'You need an admin to enable generative AI features before Seer can do anything here.'
          )}
        </Alert>
      )}
    </Stack>
  );
}

function ConnectScmStep({
  actions,
  scmButton,
  state,
}: StepProps & {scmButton?: React.ReactNode}) {
  return (
    <Stack gap="lg" align="start">
      <StepDescription>
        {t(
          'Autofix reads your source code to find the root cause, write a fix, and open the pull request. Connect GitHub to give it access.'
        )}
      </StepDescription>
      {state.canWriteOrgSettings ? (
        (scmButton ?? (
          <Button variant="primary" size="sm" onClick={actions.connectScm}>
            {t('Connect GitHub')}
          </Button>
        ))
      ) : (
        <Alert variant="warning">
          {t('You need an admin to install the GitHub integration.')}
        </Alert>
      )}
    </Stack>
  );
}

function RepoLinkRow({actions, link, state}: StepProps & {link: SeerRepoLink}) {
  // A repository can only back one project here, so hide the ones already spoken
  // for by another row.
  const takenRepoIds = new Set(
    state.repoLinks.filter(other => other.id !== link.id).map(other => other.repoId)
  );

  return (
    <Flex gap="md" align="center" wrap="wrap">
      <CompactSelect
        size="sm"
        disabled={!state.canWriteOrgSettings}
        value={link.repoId}
        menuTitle={t('Repository')}
        options={state.availableRepos
          .filter(repo => !takenRepoIds.has(repo.id))
          .map(repo => ({value: repo.id, label: repo.name}))}
        onChange={option => actions.setLinkRepo(link.id, String(option.value))}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps}>
            {state.availableRepos.find(repo => repo.id === link.repoId)?.name ??
              t('Select a repository')}
          </OverlayTrigger.Button>
        )}
      />
      <Text variant="muted">{'\u2192'}</Text>
      <CompactSelect
        size="sm"
        disabled={!state.canWriteOrgSettings}
        value={link.projectId}
        menuTitle={t('Project')}
        options={state.availableProjects.map(project => ({
          value: project.id,
          label: project.slug,
        }))}
        onChange={option => actions.setLinkProject(link.id, String(option.value))}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps}>
            {state.availableProjects.find(project => project.id === link.projectId)
              ?.slug ?? t('Select a project')}
          </OverlayTrigger.Button>
        )}
      />
      <Button
        size="sm"
        variant="transparent"
        icon={<IconDelete />}
        aria-label={t('Remove repository')}
        disabled={!state.canWriteOrgSettings}
        onClick={() => actions.removeRepoLink(link.id)}
      />
    </Flex>
  );
}

function LinkReposStep({actions, state}: StepProps) {
  return (
    <Stack gap="lg" align="start">
      <StepDescription>
        {t(
          'Pick the repository each project ships from. Without one, Autofix can triage an issue but has nothing to write a fix against.'
        )}
      </StepDescription>

      {state.repoLinks.length > 0 ? (
        <Stack gap="md">
          {state.repoLinks.map(link => (
            <RepoLinkRow key={link.id} link={link} actions={actions} state={state} />
          ))}
        </Stack>
      ) : null}

      <Button
        size="sm"
        icon={<IconAdd />}
        disabled={!state.canWriteOrgSettings}
        onClick={actions.addRepoLink}
        variant={state.repoLinks.length > 0 ? 'secondary' : 'primary'}
      >
        {state.repoLinks.length > 0 ? t('Add another') : t('Connect a repository')}
      </Button>
    </Stack>
  );
}

function ProjectAutomationRow({
  actions,
  project,
  state,
}: StepProps & {project: SeerOnboardingProject}) {
  const stoppingPointOptions = useStoppingPointSelectOptions();
  const current = state.stoppingPoints[project.id] ?? 'off';
  const selectedOption = stoppingPointOptions.find(
    option => toUserFacing(option.value) === current
  );

  return (
    <Flex gap="md" align="center" justify="between" wrap="wrap">
      <Text bold>{project.slug}</Text>
      <CompactSelect
        size="sm"
        disabled={!state.canWriteOrgSettings}
        value={selectedOption?.value ?? 'off'}
        options={stoppingPointOptions}
        onChange={option =>
          actions.setProjectStoppingPoint(project.id, toUserFacing(option.value))
        }
      />
    </Flex>
  );
}

function EnablePrsStep({actions, state}: StepProps) {
  const linkedProjects = getLinkedProjects(state);

  return (
    <Stack gap="xl" align="start">
      <StepDescription>
        {tct(
          'Choose how far an automated run should go for each project. "Stop after PR drafted" lets Seer triage new issues in the background and open a pull request for the [actionable:most actionable] ones.',
          {actionable: <ExternalLink href={AUTOMATION_DOCS} />}
        )}
      </StepDescription>

      {linkedProjects.length > 0 ? (
        <Stack gap="md" width="100%" maxWidth="440px">
          {linkedProjects.map(project => (
            <ProjectAutomationRow
              key={project.id}
              project={project}
              actions={actions}
              state={state}
            />
          ))}
        </Stack>
      ) : (
        <Alert variant="info">
          {t('Link a repository to a project first — there is nothing to automate yet.')}
        </Alert>
      )}

      <Stack gap="sm">
        <Flex align="center" gap="md">
          <Switch
            checked={state.enableSeerCoding}
            disabled={!state.canWriteOrgSettings || state.isCodingSettingManaged}
            onChange={event => actions.setEnableSeerCoding(event.target.checked)}
          />
          <Text bold>{t('Enable Code Generation')}</Text>
        </Flex>
        <Text size="sm" variant="muted">
          {tct(
            'Allow Seer to create PRs or branches in your repositories. [docs:Read the docs] to learn more.',
            {docs: <ExternalLink href={CODE_GENERATION_DOCS} />}
          )}
        </Text>
        {state.isCodingSettingManaged ? (
          <Alert variant="info">
            {t('Code generation is managed by your organization.')}
          </Alert>
        ) : null}
      </Stack>
    </Stack>
  );
}

/**
 * Setup is deliberately not gated on billing: an organization can wire every step
 * up before it pays, so Autofix starts working the moment Seer is switched on.
 * Returns why nothing is running yet, or null when Seer is live.
 */
function getInactiveReason(state: SeerOnboardingState) {
  if (state.entitlement === 'none') {
    return {
      ctaLabel: t('Add Seer to your plan'),
      shortCtaLabel: t('Add Seer'),
      notice: t(
        'Seer is not on this plan yet. You can still set everything up now — Autofix will start running as soon as Seer is added.'
      ),
      readyDescription: t(
        'Everything is configured. Add Seer and it will start triaging new issues, working out the root cause, and opening pull requests for the most actionable ones.'
      ),
    };
  }
  if (!state.hasAutofixBudget) {
    return {
      ctaLabel: t('Add Seer budget'),
      shortCtaLabel: t('Add budget'),
      notice: t(
        'This organization is out of Seer budget, so automated runs are paused. Setup changes still stick.'
      ),
      readyDescription: t(
        'Everything is configured. Automated runs resume as soon as this organization has Seer budget again.'
      ),
    };
  }
  return null;
}

type InactiveReason = NonNullable<ReturnType<typeof getInactiveReason>>;

function AllSetPanel({
  actions,
  inactiveReason,
}: {
  actions: SeerOnboardingActions;
  inactiveReason: InactiveReason | null;
}) {
  const organization = useOrganization();

  return (
    <Flex align="center" gap="2xl">
      <Image src={seerConfigCheck} alt="" height="112px" />
      <Stack gap="md" align="start">
        <Heading as="h3" size="lg">
          {inactiveReason ? t('Autofix is ready and waiting') : t('Autofix is ready')}
        </Heading>
        <Text variant="muted">
          {inactiveReason
            ? inactiveReason.readyDescription
            : t(
                'Seer will triage new issues as they arrive, work out the root cause, write a fix, and open a pull request for the most actionable ones.'
              )}
        </Text>
        <Text variant="muted">
          {tct(
            '[settings:Seer settings] holds everything you just set up, plus per-repository branches and instructions. [docs:Read the docs].',
            {
              settings: <Link to={`/settings/${organization.slug}/seer/projects/`} />,
              docs: <ExternalLink href={AUTOFIX_DOCS} />,
            }
          )}
        </Text>
        {inactiveReason ? (
          <Button variant="primary" size="sm" onClick={actions.activateSeer}>
            {inactiveReason.ctaLabel}
          </Button>
        ) : null}
      </Stack>
    </Flex>
  );
}

function SeerInactiveNotice({
  actions,
  inactiveReason,
}: {
  actions: SeerOnboardingActions;
  inactiveReason: InactiveReason;
}) {
  return (
    <Alert
      variant="info"
      trailingItems={
        <Button size="xs" onClick={actions.activateSeer}>
          {inactiveReason.shortCtaLabel}
        </Button>
      }
    >
      {inactiveReason.notice}
    </Alert>
  );
}

/**
 * A gate the modal deliberately does not try to resolve yet — it names what is
 * wrong instead of pretending to fix it. The real upsell and permission flows
 * already exist elsewhere and should be wired in when this modal goes live.
 */
function BlockedPanel({
  description,
  title,
}: {
  description: React.ReactNode;
  title: string;
}) {
  return (
    <Flex align="center" gap="2xl">
      <Image src={seerConfigBug1} alt="" height="112px" />
      <Stack gap="md">
        <Heading as="h3" size="lg">
          {title}
        </Heading>
        <Text variant="muted">{description}</Text>
      </Stack>
    </Flex>
  );
}

function getBlocker(state: SeerOnboardingState) {
  if (!state.hasScmWriteAccess) {
    return {
      title: t('Missing repository write access'),
      description: t(
        'Seer can read your code but cannot push a branch, so it will stop short of opening a pull request. Update the GitHub app permissions to continue.'
      ),
    };
  }
  return null;
}

/**
 * A step you can jump straight to, instead of clicking Back and Next through
 * everything in between.
 *
 * `GuidedSteps.Step` renders its own header as a permanently disabled button and
 * exposes no click handler, so the affordance goes in `trailingItems` — which is
 * the one slot that renders for collapsed steps too. Jumping needs
 * `useGuidedStepsContext`, which only resolves inside `<GuidedSteps>`, hence the
 * wrapper.
 */
function JumpableStep({
  children,
  isCompleted,
  settingsHint,
  stepKey,
  title,
}: {
  children: React.ReactNode;
  isCompleted: boolean;
  settingsHint: React.ReactNode;
  stepKey: string;
  title: string;
}) {
  const {getStepNumber, setCurrentStep} = useGuidedStepsContext();

  return (
    <GuidedSteps.Step
      stepKey={stepKey}
      title={title}
      isCompleted={isCompleted}
      trailingItems={
        <Button
          size="xs"
          variant="transparent"
          icon={<IconChevron direction="right" />}
          aria-label={t('Go to “%s”', title)}
          // `getStepNumber` reads the registry at call time, so this resolves
          // correctly even though steps register after the first render.
          onClick={() => setCurrentStep(getStepNumber(stepKey))}
        />
      }
    >
      {children}
      <GuidedSteps.StepButtons />
      <Container paddingTop="lg">{settingsHint}</Container>
    </GuidedSteps.Step>
  );
}

interface SeerOnboardingModalProps extends ModalRenderProps {
  actions: SeerOnboardingActions;
  state: SeerOnboardingState;
  /**
   * Rendered in place of the default "Connect GitHub" button. Exists so a
   * caller can supply the real integration install button without this
   * component reaching into getsentry.
   */
  scmButton?: React.ReactNode;
}

export function SeerOnboardingModal({
  Body,
  Footer,
  Header,
  actions,
  closeModal,
  scmButton,
  state,
}: SeerOnboardingModalProps) {
  const orgSlug = useOrganization().slug;
  const blocker = getBlocker(state);

  const aiEnabled = !state.hideAiFeatures;
  // Generative AI is on by default, so for almost every org this is not a setup
  // step at all — it is an exception. Only show it when it is actually blocking.
  // Decided once on open: GuidedSteps fixes step order at mount, and the step
  // must not vanish from under someone who has just used it.
  const [showAiStep] = useState(() => state.hideAiFeatures);
  const scmConnected = state.hasSupportedScmIntegration;
  const reposLinked = getLinkedProjects(state).length > 0;
  const prsEnabled = willOpenPullRequests(state);
  const isComplete = aiEnabled && scmConnected && reposLinked && prsEnabled;
  // Billing is not a setup step. An unpaid org walks the same four steps and
  // simply has nothing running at the end of them.
  const inactiveReason = getInactiveReason(state);

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h2" size="xl">
          {t('Set up Seer Autofix')}
        </Heading>
      </Header>
      <Body>
        {blocker ? (
          <BlockedPanel title={blocker.title} description={blocker.description} />
        ) : isComplete ? (
          <AllSetPanel actions={actions} inactiveReason={inactiveReason} />
        ) : (
          <Stack gap="xl">
            {inactiveReason ? (
              <SeerInactiveNotice actions={actions} inactiveReason={inactiveReason} />
            ) : null}
            <Text variant="muted">
              {t(
                'A few things have to be true before Seer can triage issues in the background and open a pull request for you.'
              )}
            </Text>
            <GuidedSteps>
              {showAiStep ? (
                <JumpableStep
                  stepKey="enable-ai"
                  title={t('Turn on generative AI')}
                  isCompleted={aiEnabled}
                  settingsHint={
                    <SettingsHint>
                      {tct(
                        'Change this later under [link:Show Generative AI Features].',
                        {link: <Link to={`/settings/${orgSlug}/#hideAiFeatures`} />}
                      )}
                    </SettingsHint>
                  }
                >
                  <EnableAiStep actions={actions} state={state} />
                </JumpableStep>
              ) : null}
              <JumpableStep
                stepKey="connect-scm"
                title={t('Connect your source code')}
                isCompleted={scmConnected}
                settingsHint={
                  <SettingsHint>
                    {tct(
                      'Repository access and permissions are managed under [link:Integrations].',
                      {link: <Link to={`/settings/${orgSlug}/integrations/github/`} />}
                    )}
                  </SettingsHint>
                }
              >
                <ConnectScmStep actions={actions} state={state} scmButton={scmButton} />
              </JumpableStep>
              <JumpableStep
                stepKey="link-repos"
                title={t('Link a repository to a project')}
                isCompleted={reposLinked}
                settingsHint={
                  <SettingsHint>
                    {tct(
                      'Change these later in [link:Autofix settings], along with each repository’s working branch and instructions.',
                      {link: <Link to={`/settings/${orgSlug}/seer/projects/`} />}
                    )}
                  </SettingsHint>
                }
              >
                <LinkReposStep actions={actions} state={state} />
              </JumpableStep>
              <JumpableStep
                stepKey="enable-prs"
                title={t('Let Seer open pull requests')}
                isCompleted={prsEnabled}
                settingsHint={
                  <SettingsHint>
                    {tct(
                      'Change these later in [link:Autofix settings], set the default for new projects under [defaults:Defaults], or manage code generation in [advanced:Advanced settings].',
                      {
                        link: <Link to={`/settings/${orgSlug}/seer/projects/`} />,
                        defaults: (
                          <Link to={`/settings/${orgSlug}/seer/projects/defaults/`} />
                        ),
                        advanced: (
                          <Link
                            to={`/settings/${orgSlug}/seer/advanced/#enableSeerCoding`}
                          />
                        ),
                      }
                    )}
                  </SettingsHint>
                }
              >
                <EnablePrsStep actions={actions} state={state} />
              </JumpableStep>
            </GuidedSteps>
          </Stack>
        )}
      </Body>
      <Footer>
        <Button
          variant={isComplete || blocker ? 'primary' : 'secondary'}
          onClick={closeModal}
        >
          {isComplete || blocker ? t('Done') : t('Finish later')}
        </Button>
      </Footer>
    </Fragment>
  );
}
