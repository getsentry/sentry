import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {BookmarkStar} from 'sentry/components/projects/bookmarkStar';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = {
  organization: Organization;
  project: Project;
};

export function ProjectItem({project, organization}: Props) {
  return (
    <Wrapper>
      <BookmarkStar organization={organization} project={project} />
      <ProjectBadge
        to={`/settings/${organization.slug}/projects/${project.slug}/`}
        avatarSize={18}
        project={project}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: ${p => p.theme.space.lg};
`;
