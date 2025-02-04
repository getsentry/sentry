import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/replays-empty-state.svg';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import {canCreateProject} from 'sentry/components/projects/canCreateProject';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Accordion from 'sentry/components/replays/accordion';
import ReplayUnsupportedAlert from 'sentry/components/replays/alerts/replayUnsupportedAlert';
import {Tooltip} from 'sentry/components/tooltip';
import {replayPlatforms} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {HeaderContainer, WidgetContainer} from 'sentry/views/profiling/landing/styles';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import ReplayPanel from 'sentry/views/replays/list/replayPanel';

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
  const canUserCreateProject = canCreateProject(organization);

  const supportedPlatforms = replayPlatforms;

  const selectedProjects = projects.projects.filter(p =>
    pageFilters.selection.projects.includes(Number(p.id))
  );

  const hasSelectedProjects = selectedProjects.length > 0;

  const allProjectsUnsupported = projects.projects.every(
    p => !supportedPlatforms.includes(p.platform!)
  );

  const allSelectedProjectsUnsupported = selectedProjects.every(
    p => !supportedPlatforms.includes(p.platform!)
  );

  // if all projects are unsupported we should prompt the user to create a project
  // else we prompt to setup
  const primaryAction = allProjectsUnsupported ? 'create' : 'setup';
  // disable "create" if the user has insufficient permissions
  // disable "setup" if the current selected pageFilters are not supported
  const primaryActionDisabled =
    primaryAction === 'create'
      ? !canUserCreateProject
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
          <ReplayUnsupportedAlert projectSlug={selectedProjects[0]!.slug} />
        )}
      </OnboardingAlertHook>
      <ReplayPanel image={<HeroImage src={emptyStateImg} breakpoints={breakpoints} />}>
        <OnboardingCTAHook organization={organization}>
          <SetupReplaysCTA
            orgSlug={organization.slug}
            primaryAction={primaryAction}
            disabled={primaryActionDisabled}
          />
        </OnboardingCTAHook>
      </ReplayPanel>
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
  const [expanded, setExpanded] = useState(-1);
  const {allMobileProj} = useAllMobileProj({});

  const FAQ = [
    {
      header: (
        <QuestionContent>{t('Can I use Session Replay with my app?')}</QuestionContent>
      ),
      content: (
        <AnswerContent>
          <div>
            {t(
              'Session Replay supports all browser-based applications and certain native mobile platforms, such as Android, iOS, and React Native.'
            )}
          </div>
          <div>
            {t(
              'For browser-based applications, this includes static websites, single-page applications, and also server-side rendered applications. The only prerequisite is that your application uses Sentry JavaScript SDK (version 7.2.0 or greater) either with NPM/Yarn or with our JS Loader script.'
            )}
          </div>
          <div>
            {tct(
              'To learn more about which SDKs we support, please visit [link:our docs].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/session-replay/getting-started/" />
                ),
              }
            )}
          </div>
        </AnswerContent>
      ),
    },
    {
      header: <QuestionContent>{t('What’s the performance overhead?')}</QuestionContent>,
      content: (
        <AnswerContent>
          <div>
            {t(
              'Session Replay adds a small amount of performance overhead to your web or mobile application. For most applications, the performance overhead of our client SDK will be imperceptible to end-users. For example, the Sentry site has Replay enabled and we have not seen any significant slowdowns.'
            )}
          </div>
          <div>
            {t(
              'For web, the performance overhead generally scales linearly with the DOM complexity of your application. The more DOM state changes that occur in the application lifecycle, the more events that are captured, transmitted, etc.'
            )}
          </div>
          <div>
            {tct(
              'With early customers of Mobile Replay, the overhead was not noticeable by end-users, but depending on your application complexity, you may discover the recording overhead may negatively impact your mobile application performance. If you do, please let us know on GitHub: [android:Android], [ios:iOS], and [rn:React Native].',
              {
                android: (
                  <ExternalLink href="https://github.com/getsentry/sentry-java/issues/new/choose" />
                ),
                ios: (
                  <ExternalLink href="https://github.com/getsentry/sentry-cocoa/issues/new/choose" />
                ),
                rn: (
                  <ExternalLink href="https://github.com/getsentry/sentry-react-native/issues/new/choose" />
                ),
              }
            )}
          </div>
          <div>
            {tct(
              'To learn more about how we’ve optimized our SDK, please visit [link:our docs].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/explore/session-replay/performance-overhead/" />
                ),
              }
            )}
          </div>
        </AnswerContent>
      ),
    },
    {
      header: <QuestionContent>{t('How do you protect user data?')}</QuestionContent>,
      content: (
        <AnswerContent>
          <div>
            {t(
              'We offer a range of privacy controls to let developers ensure that no sensitive user information leaves the browser. By default, our privacy configuration is very aggressive and masks all text and images, but you can choose to just mask user input text, for example.'
            )}
          </div>
          <div>
            {tct(
              'To learn more about how we protect user privacy, please visit [link:our docs].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/session-replay/protecting-user-privacy/" />
                ),
              }
            )}
          </div>
        </AnswerContent>
      ),
    },
  ];

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
            type="button"
            onClick={() => activateSidebar()}
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
            {t('You do not have permission to create a project.')}
          </span>
        }
        disabled={!disabled}
      >
        <LinkButton
          data-test-id="create-project-btn"
          to={`/organizations/${orgSlug}/projects/new/`}
          priority="primary"
          disabled={disabled}
        >
          {t('Create Project')}
        </LinkButton>
      </Tooltip>
    );
  }

  return (
    <CenteredContent>
      <h3>{t('Get to the root cause faster')}</h3>
      <p>
        {t(
          'See a video-like reproduction of your user sessions so you can see what happened before, during, and after an error or latency issue occurred.'
        )}
      </p>
      <ButtonList gap={1}>
        {renderCTA()}
        <LinkButton
          href={
            allMobileProj
              ? 'https://docs.sentry.io/product/explore/session-replay/mobile/'
              : 'https://docs.sentry.io/product/explore/session-replay/'
          }
          external
        >
          {t('Read Docs')}
        </LinkButton>
      </ButtonList>
      <StyledWidgetContainer>
        <StyledHeaderContainer>
          {t('FAQ')}
          <QuestionTooltip
            size="xs"
            isHoverable
            title={tct('See a [link:full list of FAQs].', {
              link: (
                <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/23699186513947-Session-Replay-FAQ" />
              ),
            })}
          />
        </StyledHeaderContainer>
        <Accordion items={FAQ} expandedIndex={expanded} setExpandedIndex={setExpanded} />
      </StyledWidgetContainer>
    </CenteredContent>
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

const StyledWidgetContainer = styled(WidgetContainer)`
  margin: ${space(4)} 0 ${space(1)} 0;
`;

const CenteredContent = styled('div')`
  padding: ${space(3)};
`;

const AnswerContent = styled('div')`
  display: grid;
  gap: ${space(2)};
  padding: ${space(2)};
`;

const QuestionContent = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  cursor: pointer;
`;

const StyledHeaderContainer = styled(HeaderContainer)`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray300};
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;
