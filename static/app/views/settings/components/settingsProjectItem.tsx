import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';

type Props = {
  organization: Organization;
  project: Project;
};

function ProjectItem({project, organization}: Props) {
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
  gap: ${space(1.5)};
`;

export default ProjectItem;
