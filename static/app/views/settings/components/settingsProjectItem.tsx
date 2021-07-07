import {Component} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'app/components/idBadge/projectBadge';
import BookmarkStar from 'app/components/projects/bookmarkStar';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';

type Props = {
  project: Project;
  organization: Organization;
};

type State = {
  isBookmarked: boolean;
};

class ProjectItem extends Component<Props, State> {
  state: State = {
    isBookmarked: this.props.project.isBookmarked,
  };

  handleToggleBookmark = (isBookmarked: State['isBookmarked']) => {
    this.setState({isBookmarked});
  };

  render() {
    const {project, organization} = this.props;

    return (
      <Wrapper>
        <BookmarkLink
          organization={organization}
          project={project}
          isBookmarked={this.state.isBookmarked}
          onToggle={this.handleToggleBookmark}
        />
        <ProjectBadge
          to={`/settings/${organization.slug}/projects/${project.slug}/`}
          avatarSize={18}
          project={project}
        />
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const BookmarkLink = styled(BookmarkStar)`
  margin-right: ${space(1)};
  margin-top: -${space(0.25)};
`;

export default ProjectItem;
