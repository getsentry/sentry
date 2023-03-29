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

export default function ReplayOnboardingPanel() {
  const preferences = useLegacyStore(PreferencesStore);
  const pageFilters = usePageFilters();
  const projects = useProjects();
  const selectedProjects = projects.projects.filter(p =>
    pageFilters.selection.projects.includes(Number(p.id))
  );

  const allProjectsUnsupported = selectedProjects.every(
    p => !replayPlatforms.includes(p.platform!)
  );

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

  const organization = useOrganization();

  return (
    <Fragment>
      {allProjectsUnsupported && (
        <Alert icon={<IconInfo />}>
          {tct(
            `[projectMsg] Select a project using our [link], or equivalent framework SDK.`,
            {
              projectMsg: (
                <strong>
                  {t(`Session Replay isn't available for %s.`, selectedProjects[0].slug)}
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
      <OnboardingPanel
        image={<HeroImage src={emptyStateImg} breakpoints={breakpoints} />}
      >
        <Feature
          features={['session-replay-ga']}
          organization={organization}
          renderDisabled={() => <SetupReplaysCTA disableSetup={allProjectsUnsupported} />}
        >
          <OnboardingCTAHook organization={organization}>
            <SetupReplaysCTA disableSetup={allProjectsUnsupported} />
          </OnboardingCTAHook>
        </Feature>
      </OnboardingPanel>
    </Fragment>
  );
}

function SetupReplaysCTA({disableSetup}: {disableSetup: boolean}) {
  const {activateSidebar} = useReplayOnboardingSidebarPanel();

  return (
    <Fragment>
      <h3>{t('Get to the root cause faster')}</h3>
      <p>
        {t(
          'See a video-like reproduction of your user sessions so you can see what happened before, during, and after an error or latency issue occurred.'
        )}
      </p>
      <ButtonList gap={1}>
        <Button onClick={activateSidebar} priority="primary" disabled={disableSetup}>
          {t('Set Up Replays')}
        </Button>
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
