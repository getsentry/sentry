import styled from '@emotion/styled';
import { Component } from 'react';

import BookmarkStar from 'app/components/projects/bookmarkStar';
import Link from 'app/components/links/link';
import ProjectLabel from 'app/components/projectLabel';
import space from 'app/styles/space';
import {Project, Organization} from 'app/types';

type Props = {
  project: Project;
  organization: Organization;
};

type State = {
  isBookmarked: boolean;
};

class ProjectItem extends Component<Props, State> {
  state = {
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
        <Link to={`/settings/${organization.slug}/projects/${project.slug}/`}>
          <ProjectLabel project={project} />
        </Link>
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
