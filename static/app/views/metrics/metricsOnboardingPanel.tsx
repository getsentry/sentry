import {Fragment} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/custom-metrics-empty-state.svg';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import {useProjectCreationAccess} from 'sentry/components/projects/useProjectCreationAccess';
import {Tooltip} from 'sentry/components/tooltip';
import {
  customMetricPlatforms,
  withoutPerformanceSupport,
} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useMetricsOnboardingSidebar} from 'sentry/views/metrics/ddmOnboarding/useMetricsOnboardingSidebar';
import {useSelectedProjects} from 'sentry/views/metrics/utils/useSelectedProjects';

type Breakpoints = {
  large: string;
  medium: string;
  small: string;
  xlarge: string;
};

export default function MetricsOnboardingPanel() {
  const preferences = useLegacyStore(PreferencesStore);
  const selectedProjects = useSelectedProjects();
  const {projects} = useProjects();
  const organization = useOrganization();
  const {canCreateProject} = useProjectCreationAccess({organization});

  const hasSelectedProjects = selectedProjects.length > 0;

  const allProjectsUnsupported = projects.every(
    p =>
      !customMetricPlatforms.includes(p.platform!) &&
      withoutPerformanceSupport.has(p.platform!)
  );

  const allSelectedProjectsUnsupported = selectedProjects.every(
    p => !customMetricPlatforms.includes(p.platform!)
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
      <Panel>
        <Container>
          <ImageWrapper>
            <HeroImage src={emptyStateImg} breakpoints={breakpoints} />
          </ImageWrapper>
          <StyledBox>
            <SetupReplaysCTA
              orgSlug={organization.slug}
              primaryAction={primaryAction}
              disabled={primaryActionDisabled}
              hasPerformance={selectedProjects.some(p => p.firstTransactionEvent)}
            />
          </StyledBox>
        </Container>
      </Panel>
    </Fragment>
  );
}

interface SetupReplaysCTAProps {
  disabled: boolean;
  hasPerformance: boolean;
  orgSlug: string;
  primaryAction: 'setup' | 'create';
}

export function SetupReplaysCTA({
  disabled,
  primaryAction = 'setup',
  hasPerformance,
  orgSlug,
}: SetupReplaysCTAProps) {
  const {activateSidebar} = useMetricsOnboardingSidebar();

  function renderCTA() {
    if (primaryAction === 'setup') {
      return (
        <Fragment>
          <Tooltip
            title={t('Select a supported project from the projects dropdown.')}
            disabled={!disabled} // we only want to show the tooltip when the button is disabled
          >
            <Button
              data-test-id="setup-replays-btn"
              onClick={activateSidebar}
              priority="primary"
              disabled={disabled}
            >
              {t('Set Up Custom Metrics')}
            </Button>
          </Tooltip>
          <Tooltip
            isHoverable
            title={tct('Requires [link:Performance Monitoring]', {
              link: <ExternalLink href="https://docs.sentry.io/product/performance/" />,
            })}
            disabled={!hasPerformance} // we only want to show the tooltip when the button is disabled
          >
            <Button
              data-test-id="setup-replays-btn"
              onClick={activateSidebar}
              priority="primary"
              disabled={!hasPerformance}
            >
              {t('View Performance Metrics')}
            </Button>
          </Tooltip>
        </Fragment>
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
      <h3>{t('Track and solve what matters')}</h3>
      <p>
        {t(
          'Create custom metrics to track and visualize the data points you care about over time, like processing time, checkout conversion rate, or user signups. See correlated trace exemplars and metrics if used together with Performance Monitoring.'
        )}
      </p>
      <ButtonList gap={1}>
        {renderCTA()}
        <LinkButton
          href="https://docs.sentry.io/product/metrics/metrics-set-up/"
          external
        >
          {t('Read Docs')}
        </LinkButton>
      </ButtonList>
    </CenteredContent>
  );
}

const HeroImage = styled('img')<{breakpoints: Breakpoints}>`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    user-select: none;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 220px;
    margin-top: auto;
    margin-bottom: auto;
    transform: translateX(-50%);
    left: 55%;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    transform: translateX(-60%);
    width: 280px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    transform: translateX(-75%);
    width: 320px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

const CenteredContent = styled('div')`
  padding: ${space(3)};
`;

const Container = styled('div')`
  padding: ${space(3)};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    min-height: 300px;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    min-height: 350px;
  }
`;

const StyledBox = styled('div')`
  min-width: 0;
  z-index: 1;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex: 2;
  }
`;

const ImageWrapper = styled(StyledBox)`
  position: relative;
  min-height: 100px;
  max-width: 300px;
  min-width: 150px;
  margin: ${space(2)} auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex: 1;
    margin: ${space(2)} auto;
    max-width: auto;
  }
`;
