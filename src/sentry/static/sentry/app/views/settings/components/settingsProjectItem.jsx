import styled from 'react-emotion';
import React from 'react';

import createReactClass from 'create-react-class';
import theme from '../../../utils/theme';

import {update} from '../../../actionCreators/projects';
import ApiMixin from '../../../mixins/apiMixin';
import Tooltip from '../../../components/tooltip';

import Link from '../../../components/link';
import ProjectLabel from '../../../components/projectLabel';
import SentryTypes from '../../../proptypes';

const InlineButton = styled('button')`
  color: ${p => p.theme.gray1};
  border: none;
  background-color: inherit;
  padding: 0;
`;

const StyledProjectLabel = styled(ProjectLabel)`
  color: ${p => p.theme.blue};
`;

const ProjectItem = createReactClass({
  displayName: 'ProjectItem',

  propTypes: {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      isBookmarked: this.props.project.isBookmarked,
    };
  },

  componentWillReceiveProps(nextProps) {
    // Local bookmarked state should be unset when the project data changes
    // Local state is used for optimistic UI update
    if (this.state.isBookmarked !== nextProps.project.isBookmarked) {
      this.setState({isBookmarked: nextProps.project.isBookmarked});
    }
  },

  handleToggleBookmark() {
    let {project, organization} = this.props;
    let {isBookmarked} = this.state;

    this.setState({isBookmarked: !isBookmarked}, () =>
      update(this.api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {
          isBookmarked: this.state.isBookmarked,
        },
      })
    );
    //needed to dismiss tooltip
    document.activeElement.blur();
  },

  render() {
    let {project, organization} = this.props;
    let org = organization;
    let {isBookmarked} = this.state;

    return (
      <div key={project.id} className={isBookmarked ? 'isBookmarked' : null}>
        <Tooltip title={isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}>
          <InlineButton onClick={() => this.handleToggleBookmark()}>
            {isBookmarked ? (
              <span className="icon-star-solid bookmark" />
            ) : (
              <span className="icon-star-outline bookmark" />
            )}
          </InlineButton>
        </Tooltip>
        <Link to={`/settings/${org.slug}/${project.slug}/`} css={{color: theme.gray3}}>
          <StyledProjectLabel project={project} organization={this.props.organization} />
        </Link>
      </div>
    );
  },
});

export default ProjectItem;
