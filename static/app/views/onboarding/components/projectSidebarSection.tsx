import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion, Variants} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import testableTransition from 'sentry/utils/testableTransition';

type Props = {
  activeProject: Project | null;
  checkProjectHasFirstEvent: (project: Project) => boolean;
  projects: Project[];
  selectProject: (newProjectId: string) => void;
  // A map from selected platform keys to the projects created by onboarding.
  selectedPlatformToProjectIdMap: {[key in PlatformKey]?: string};
};
function ProjectSidebarSection({
  projects,
  activeProject,
  selectProject,
  checkProjectHasFirstEvent,
  selectedPlatformToProjectIdMap,
}: Props) {
  const oneProject = (platformOnCreate: string, projectSlug: string) => {
    const project = projects.find(p => p.slug === projectSlug);
    const platform = project ? project.platform || 'other' : platformOnCreate;
    const platformName = platforms.find(p => p.id === platform)?.name ?? '';
    const isActive = !!project && activeProject?.id === project.id;
    const errorReceived = !!project && checkProjectHasFirstEvent(project);
    return (
      <ProjectWrapper
        key={projectSlug}
        isActive={isActive}
        onClick={() => project && selectProject(project.id)}
        disabled={!project}
      >
        <StyledPlatformIcon platform={platform} size={36} />
        <MiddleWrapper>
          <NameWrapper>{platformName}</NameWrapper>
          <SubHeader errorReceived={errorReceived} data-test-id="sidebar-error-indicator">
            {!project
              ? t('Project Deleted')
              : errorReceived
              ? t('Error Received')
              : t('Waiting for error')}
          </SubHeader>
        </MiddleWrapper>
        {errorReceived ? (
          <StyledIconCheckmark isCircled color="green400" />
        ) : (
          isActive && <WaitingIndicator />
        )}
      </ProjectWrapper>
    );
  };
  return (
    <Fragment>
      <Title>{t('Projects to Setup')}</Title>
      {Object.entries(selectedPlatformToProjectIdMap).map(
        ([platformOnCreate, projectSlug]) => oneProject(platformOnCreate, projectSlug)
      )}
    </Fragment>
  );
}

export default ProjectSidebarSection;

const Title = styled('span')`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: ${space(2)};
`;

const SubHeader = styled('div')<{errorReceived: boolean}>`
  color: ${p => (p.errorReceived ? p.theme.successText : p.theme.pink400)};
`;

const StyledPlatformIcon = styled(PlatformIcon)``;

const ProjectWrapper = styled('div')<{disabled: boolean; isActive: boolean}>`
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: ${p => p.isActive && p.theme.gray100};
  padding: ${space(2)};
  cursor: pointer;
  border-radius: 4px;
  user-select: none;
  ${p =>
    p.disabled &&
    `
    cursor: not-allowed;
    ${StyledPlatformIcon} {
      filter: grayscale(1);
    }
    ${SubHeader} {
      color: ${p.theme.gray400};
    }
    ${NameWrapper} {
      text-decoration-line: line-through;
    }
  `}
`;

const indicatorAnimation: Variants = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
};

const WaitingIndicator = styled(motion.div)`
  margin: 0 6px;
  flex-shrink: 0;
  ${pulsingIndicatorStyles};
  background-color: ${p => p.theme.pink300};
`;
const StyledIconCheckmark = styled(IconCheckmark)`
  flex-shrink: 0;
`;

WaitingIndicator.defaultProps = {
  variants: indicatorAnimation,
  transition: testableTransition(),
};

const MiddleWrapper = styled('div')`
  margin: 0 ${space(1)};
  flex-grow: 1;
  overflow: hidden;
`;

const NameWrapper = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
