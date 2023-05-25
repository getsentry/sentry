import {Fragment} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/replays-empty-state.svg';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {useProjectCreationAccess} from 'sentry/components/projects/useProjectCreationAccess';
import {Tooltip} from 'sentry/components/tooltip';
import {replayPlatforms} from 'sentry/data/platformCategories';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

type Breakpoints = {
  large: string;
  medium: string;
  small: string;
  xlarge: string;
};

const OnboardingCTAHook = HookOrDefault({
  hookName: 'component:replay-onboarding-cta',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

const OnboardingAlertHook = HookOrDefault({
  hookName: 'component:replay-onboarding-alert',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

export default function ReplayOnboardingPanel() {
  const preferences = useLegacyStore(PreferencesStore);
  const pageFilters = usePageFilters();
  const projects = useProjects();
  const organization = useOrganization();
  const {canCreateProject} = useProjectCreationAccess(organization);

  const selectedProjects = projects.projects.filter(p =>
    pageFilters.selection.projects.includes(Number(p.id))
  );

  const hasSelectedProjects = selectedProjects.length > 0;

  const allProjectsUnsupported = projects.projects.every(
    p => !replayPlatforms.includes(p.platform!)
  );

  const allSelectedProjectsUnsupported = selectedProjects.every(
    p => !replayPlatforms.includes(p.platform!)
  );

  // if all projects are unsupported we should prompt the user to create a project
  // else we prompt to setup
  const primaryAction = allProjectsUnsupported ? 'create' : 'setup';
  // disable "create" if the user has insufficient permissions
  // disable "setup" if the current selected pageFilters are not supported
  const primaryActionDisabled =
    primaryAction === 'create'
      ? !canCreateProject
      : allSelectedProjectsUnsupported && hasSelectedProjects;

  const breakpoints = preferences.collapsed
    ? {
        small: '800px',
        medium: '992px',
        large: '1210px',
        xlarge: '1450px',
      }
    : {
        small: '800px',
        medium: '1175px',
        large: '1375px',
        xlarge: '1450px',
      };

  return (
    <Fragment>
      <OnboardingAlertHook>
        {hasSelectedProjects && allSelectedProjectsUnsupported && (
          <Alert icon={<IconInfo />}>
            {tct(
              `[projectMsg] [action] a project using our [link], or equivalent framework SDK.`,
              {
                action: primaryAction === 'create' ? t('Create') : t('Select'),
                projectMsg: (
                  <strong>
                    {t(
                      `Session Replay isn't available for project %s.`,
                      selectedProjects[0].slug
                    )}
                  </strong>
                ),
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/">
                    {t('Sentry browser SDK package')}
                  </ExternalLink>
                ),
              }
            )}
          </Alert>
        )}
      </OnboardingAlertHook>
      <OnboardingPanel
        image={<HeroImage src={emptyStateImg} breakpoints={breakpoints} />}
      >
        <Feature
          features={['session-replay-ga']}
          organization={organization}
          renderDisabled={() => (
            <SetupReplaysCTA
              orgSlug={organization.slug}
              primaryAction={primaryAction}
              disabled={primaryActionDisabled}
            />
          )}
        >
          <OnboardingCTAHook organization={organization}>
            <SetupReplaysCTA
              orgSlug={organization.slug}
              primaryAction={primaryAction}
              disabled={primaryActionDisabled}
            />
          </OnboardingCTAHook>
        </Feature>
      </OnboardingPanel>
    </Fragment>
  );
}

interface SetupReplaysCTAProps {
  orgSlug: string;
  primaryAction: 'setup' | 'create';
  disabled?: boolean;
}

export function SetupReplaysCTA({
  disabled,
  primaryAction = 'setup',
  orgSlug,
}: SetupReplaysCTAProps) {
  const {activateSidebar} = useReplayOnboardingSidebarPanel();

  function renderCTA() {
    if (primaryAction === 'setup') {
      return (
        <Tooltip
          title={
            <span data-test-id="setup-replays-tooltip">
              {t('Select a supported project from the projects dropdown.')}
            </span>
          }
          disabled={!disabled} // we only want to show the tooltip when the button is disabled
        >
          <Button
            data-test-id="setup-replays-btn"
            onClick={activateSidebar}
            priority="primary"
            disabled={disabled}
          >
            {t('Set Up Replays')}
          </Button>
        </Tooltip>
      );
    }

    return (
      <Tooltip
        title={
          <span data-test-id="create-project-tooltip">
            {t('Only admins, managers, and owners, can create projects.')}
          </span>
        }
        disabled={!disabled}
      >
        <Button
          data-test-id="create-project-btn"
          to={`/organizations/${orgSlug}/projects/new/`}
          priority="primary"
          disabled={disabled}
        >
          {t('Create Project')}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Fragment>
      <h3>{t('Get to the root cause faster')}</h3>
      <p>
        {t(
          'See a video-like reproduction of your user sessions so you can see what happened before, during, and after an error or latency issue occurred.'
        )}
      </p>
      <ButtonList gap={1}>
        {renderCTA()}
        <Button
          href="https://docs.sentry.io/platforms/javascript/session-replay/"
          external
        >
          {t('Read Docs')}
        </Button>
      </ButtonList>
    </Fragment>
  );
}

const HeroImage = styled('img')<{breakpoints: Breakpoints}>`
  @media (min-width: ${p => p.breakpoints.small}) {
    user-select: none;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 220px;
    margin-top: auto;
    margin-bottom: auto;
    transform: translateX(-50%);
    left: 50%;
  }

  @media (min-width: ${p => p.breakpoints.medium}) {
    transform: translateX(-55%);
    width: 300px;
    min-width: 300px;
  }

  @media (min-width: ${p => p.breakpoints.large}) {
    transform: translateX(-60%);
    width: 380px;
    min-width: 380px;
  }

  @media (min-width: ${p => p.breakpoints.xlarge}) {
    transform: translateX(-65%);
    width: 420px;
    min-width: 420px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;
