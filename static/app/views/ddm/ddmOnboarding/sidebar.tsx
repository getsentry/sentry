import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {LinkButton} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import {CommonSidebarProps, SidebarPanelKey} from 'sentry/components/sidebar/types';
import {customMetricPlatforms} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project, SelectValue} from 'sentry/types';
import {METRICS_DOCS_URL} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';

import {useCurrentProjectState} from './useCurrentProjectState';

function MetricsOnboardingSidebar(props: CommonSidebarProps) {
  const {currentPanel, collapsed, hidePanel, orientation} = props;
  const organization = useOrganization();

  const isActive = currentPanel === SidebarPanelKey.METRICS_ONBOARDING;
  const hasProjectAccess = organization.access.includes('project:read');

  const {
    projects,
    allProjects,
    currentProject,
    setCurrentProject,
    supportedProjects,
    unsupportedProjects,
    hasDocs,
  } = useCurrentProjectState({
    isActive,
  });

  const projectSelectOptions = useMemo(() => {
    const supportedProjectItems: SelectValue<string>[] = supportedProjects
      .sort((aProject, bProject) => {
        // TODO(aknaus): Enable once we have thw hasCustomMetrics flag
        // if we're comparing two projects w/ or w/o custom metrics alphabetical sort
        // if (aProject.hasCustomMetrics === bProject.hasCustomMetrics) {
        return aProject.slug.localeCompare(bProject.slug);
        // }
        // otherwise sort by whether or not they have custom metrics
        // return aProject.hasCustomMetrics ? 1 : -1;
      })
      .map(project => {
        return {
          value: project.id,
          textValue: project.id,
          label: (
            <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />
          ),
        };
      });

    const unsupportedProjectItems: SelectValue<string>[] = unsupportedProjects.map(
      project => {
        return {
          value: project.id,
          textValue: project.id,
          label: (
            <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />
          ),
          disabled: true,
        };
      }
    );
    return [
      {
        label: t('Supported'),
        options: supportedProjectItems,
      },
      {
        label: t('Unsupported'),
        options: unsupportedProjectItems,
      },
    ];
  }, [supportedProjects, unsupportedProjects]);

  const selectedProject = currentProject ?? projects[0] ?? allProjects[0];
  if (!isActive || !hasProjectAccess || !selectedProject) {
    return null;
  }

  return (
    <StyledSidebarPanel
      orientation={orientation}
      collapsed={collapsed}
      hidePanel={hidePanel}
    >
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      <TaskList>
        <Heading>{t('Getting Started with custom metrics')}</Heading>
        <HeaderActions>
          <div
            onClick={e => {
              // we need to stop bubbling the CompactSelect click event
              // failing to do so will cause the sidebar panel to close
              // the event.target will be unmounted by the time the panel listener
              // receives the event and assume the click was outside the panel
              e.stopPropagation();
            }}
          >
            <CompactSelect
              triggerLabel={
                currentProject ? (
                  <StyledIdBadge
                    project={currentProject}
                    avatarSize={16}
                    hideOverflow
                    disableLink
                  />
                ) : (
                  t('Select a project')
                )
              }
              value={currentProject?.id}
              onChange={opt =>
                setCurrentProject(allProjects.find(p => p.id === opt.value))
              }
              triggerProps={{'aria-label': currentProject?.slug}}
              options={projectSelectOptions}
              position="bottom-end"
            />
          </div>
        </HeaderActions>
        <OnboardingContent currentProject={selectedProject} hasDocs={hasDocs} />
      </TaskList>
    </StyledSidebarPanel>
  );
}

function OnboardingContent({
  currentProject,
  hasDocs,
}: {
  currentProject: Project;
  hasDocs: boolean;
}) {
  const organization = useOrganization();

  const currentPlatform = currentProject.platform
    ? platforms.find(p => p.id === currentProject.platform)
    : undefined;

  const supportsCustomMetrics =
    currentProject.platform && customMetricPlatforms.has(currentProject.platform);

  if (!supportsCustomMetrics) {
    return (
      <FallbackContentWrapper>
        <div>
          {tct('Custom metrics aren’t available for your [platform] project.', {
            platform: currentPlatform?.name || currentProject.slug,
          })}
        </div>
        <div>
          <LinkButton size="sm" href={METRICS_DOCS_URL} external>
            {t('Go to Sentry Documentation')}
          </LinkButton>
        </div>
      </FallbackContentWrapper>
    );
  }

  if (!hasDocs || !currentPlatform) {
    return (
      <FallbackContentWrapper>
        <div>
          {tct(
            'Fiddlesticks. This checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
            {project: currentProject.slug}
          )}
        </div>
        <div>
          <LinkButton size="sm" href={METRICS_DOCS_URL} external>
            {t('Read Docs')}
          </LinkButton>
        </div>
      </FallbackContentWrapper>
    );
  }

  return (
    <Fragment>
      <IntroText>
        {tct(
          `Adding custom metrics to your [platform] project is simple. Make sure you've got these basics down.`,
          {platform: currentPlatform?.name || currentProject.slug}
        )}
      </IntroText>
      <SdkDocumentation
        platform={currentPlatform}
        organization={organization}
        projectSlug={currentProject.slug}
        projectId={currentProject.id}
        activeProductSelection={[]}
        configType="customMetricsOnboarding"
      />
    </Fragment>
  );
}

const IntroText = styled('div')`
  padding-top: ${space(3)};
`;

const StyledSidebarPanel = styled(SidebarPanel)`
  width: 600px;
  max-width: 100%;
`;

const TopRightBackgroundImage = styled('img')`
  position: absolute;
  top: 0;
  right: 0;
  width: 60%;
  user-select: none;
`;

const TaskList = styled('div')`
  display: grid;
  grid-auto-flow: row;
  grid-template-columns: 100%;
  gap: ${space(1)};
  margin: 50px ${space(4)} ${space(4)} ${space(4)};
`;

const Heading = styled('div')`
  display: flex;
  color: ${p => p.theme.activeText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
  font-weight: 600;
  line-height: 1;
  margin-top: ${space(3)};
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;

const HeaderActions = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(3)};
`;

const FallbackContentWrapper = styled('div')`
  padding: ${space(2)} 0px;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

export default MetricsOnboardingSidebar;
