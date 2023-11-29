import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Frame, Project} from 'sentry/types';

interface Props {
  frame: Partial<Pick<Frame, 'absPath' | 'colNo' | 'function' | 'lineNo'>>;
  project?: Project;
}

export function StackTraceMiniFrame({frame, project}: Props) {
  return (
    <FrameContainer>
      {project && (
        <ProjectAvatarContainer>
          <ProjectAvatar project={project} size={16} />
        </ProjectAvatarContainer>
      )}
      {frame.absPath && <Emphasize>{frame?.absPath}</Emphasize>}
      {frame.function && (
        <Fragment>
          <Deemphasize> {t('in')} </Deemphasize>
          <Emphasize>{frame?.function}</Emphasize>
        </Fragment>
      )}
      {frame.lineNo && (
        <Fragment>
          <Deemphasize> {t('at line')} </Deemphasize>
          <Emphasize>{frame?.lineNo}</Emphasize>
        </Fragment>
      )}
    </FrameContainer>
  );
}

const FrameContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(1.5)} ${space(2)};

  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};

  border-top: 1px solid ${p => p.theme.border};

  background: ${p => p.theme.surface200};
`;

const ProjectAvatarContainer = styled('div')`
  margin-right: ${space(1)};
`;

const Emphasize = styled('span')`
  color: ${p => p.theme.gray500};
`;

const Deemphasize = styled('span')`
  color: ${p => p.theme.gray300};
`;
