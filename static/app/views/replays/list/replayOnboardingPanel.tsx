import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/replays-empty-state.svg';

import Accordion from 'sentry/components/accordion/accordion';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import {useProjectCreationAccess} from 'sentry/components/projects/useProjectCreationAccess';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {replayPlatforms} from 'sentry/data/platformCategories';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {HeaderContainer, WidgetContainer} from 'sentry/views/profiling/landing/styles';
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
const OnboardingCTAButton = HookOrDefault({
  hookName: 'component:replay-onboarding-cta-button',
  defaultComponent: null,
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
  const {canCreateProject} = useProjectCreationAccess({organization});

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
  const FAQ = [
    {
      header: () => (
        <QuestionContent>{t('Can I use Session Replay with my app?')}</QuestionContent>
      ),
      content: () => (
        <AnswerContent>
          <div>
            {t(
              'Session Replay supports all browser-based applications. This includes static websites, single-page aplications, and also server-side rendered applications. The only prerequisite is that your application uses Sentry JavaScript SDK (version 7.2.0 or greater) either with NPM/Yarn or with our JS Loader script.'
            )}
          </div>
          <div>
            {t(
              "Replays are integrated with Sentry's tracing data model, enabling you to see replays associated with backend errors as well. You need to have Sentry set up for both your frontend and backend, along with distributed tracing."
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
      header: () => (
        <QuestionContent>{t('What’s the performance overhead?')}</QuestionContent>
      ),
      content: () => (
        <AnswerContent>
          <div>
            {t(
              'Session Replay adds a small amount of performance overhead to your web application. For most web apps, the performance overhead of our client SDK will be imperceptible to end-users. For example, the Sentry site has Replay enabled and we have not seen any significant slowdowns.'
            )}
          </div>
          <div>
            {t(
              'The performance overhead generally scales linearly with the DOM complexity of your application. The more DOM state changes that occur in the application lifecycle, the more events that are captured, transmitted, etc.'
            )}
          </div>
          <div>
            {tct(
              'To learn more about how we’ve optimized our SDK, please visit [link:our docs].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/session-replay/performance-overhead/" />
                ),
              }
            )}
          </div>
        </AnswerContent>
      ),
    },
    {
      header: () => (
        <QuestionContent>{t('How do you protect user data?')}</QuestionContent>
      ),
      content: () => (
        <AnswerContent>
          <div>
            {t(
              'We offer a range of privacy controls to let developers ensure that no sensitive user information leaves the browser. By default, our privacy configuration is very aggressive and masks all text and images, but you can choose to just mask user input text, for example.'
            )}
          </div>
          <div>
            {t(
              'Customers can also use server-side scrubbing capabilities to further filter and remove sensitive user data, or our deletion capabilities to delete individual recordings after ingestion.'
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
            {t('You do not have permission to create a project.')}
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
    <CenteredContent>
      <h3>{t('Get to the root cause faster')}</h3>
      <p>
        {t(
          'See a video-like reproduction of your user sessions so you can see what happened before, during, and after an error or latency issue occurred.'
        )}
      </p>
      <ButtonList gap={1}>
        {renderCTA()}
        <OnboardingCTAButton />
        <Button
          href="https://docs.sentry.io/platforms/javascript/session-replay/"
          external
        >
          {t('Read Docs')}
        </Button>
      </ButtonList>
      <StyledWidgetContainer>
        <StyledHeaderContainer>
          {t('FAQ')}
          {
            <QuestionTooltip
              size="xs"
              isHoverable
              title={tct('See a [link:full list of FAQs].', {
                link: (
                  <ExternalLink href="https://help.sentry.io/product-features/other/what-is-session-replay/" />
                ),
              })}
            />
          }
        </StyledHeaderContainer>
        <Accordion
          items={FAQ}
          expandedIndex={expanded}
          setExpandedIndex={setExpanded}
          buttonOnLeft
        />
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
  font-weight: bold;
  cursor: pointer;
`;

const StyledHeaderContainer = styled(HeaderContainer)`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray300};
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;
