import {css} from '@emotion/react';
import styled from '@emotion/styled';
import PlatformIcon from 'platformicons/build/platformIcon';

import {IconAllProjects, IconMyProjects} from 'sentry/icons';

interface ProjectIconProps {
  projectPlatforms: string[];
  allProjects?: boolean;
  className?: string;
}

function ProjectIcon({projectPlatforms, allProjects, className}: ProjectIconProps) {
  let renderedIcons: React.ReactNode;

  switch (projectPlatforms.length) {
    case 0:
      renderedIcons = allProjects ? (
        <IconAllProjects size="md" />
      ) : (
        <IconMyProjects size="md" />
      );
      break;
    case 1:
      renderedIcons = (
        <IconContainer>
          <StyledPlatformIcon platform={projectPlatforms[0]!} size={18} />
          <BorderOverlay />
        </IconContainer>
      );
      break;
    default:
      renderedIcons = (
        <IconContainer>
          {projectPlatforms.slice(0, 2).map((platform, index) => (
            <PlatformIconWrapper key={platform} index={index}>
              <StyledPlatformIcon platform={platform} size={14} />
              <BorderOverlay />
            </PlatformIconWrapper>
          ))}
        </IconContainer>
      );
  }

  return (
    <IconWrap className={className} data-project-icon>
      {renderedIcons}
    </IconWrap>
  );
}

const IconWrap = styled('div')`
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const IconContainer = styled('div')`
  position: relative;
  display: grid;
  width: 18px;
  height: 18px;
`;

const BorderOverlay = styled('div')`
  position: absolute;
  inset: 0;
  border: 1px solid ${p => p.theme.colors.gray100};
  border-radius: 3px;
  pointer-events: none;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  display: block;
`;

const PlatformIconWrapper = styled('div')<{index: number}>`
  position: absolute;
  width: 14px;
  height: 14px;
  ${p =>
    p.index === 0 &&
    css`
      top: 0;
      left: 0;
    `}
  ${p =>
    p.index === 1 &&
    css`
      bottom: 0;
      right: 0;
    `}
`;

export default ProjectIcon;
