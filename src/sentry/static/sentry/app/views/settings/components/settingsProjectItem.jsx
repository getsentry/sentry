import styled from 'react-emotion';

import React from 'react';

import createReactClass from 'create-react-class';

import {update} from '../../../actionCreators/projects';
import ApiMixin from '../../../mixins/apiMixin';
import TooltipMixin from '../../../mixins/tooltip';
import Link from '../../../components/link';
import ProjectLabel from '../../../components/projectLabel';
import SentryTypes from '../../../proptypes';

const StyledH5 = styled('h5')`
  margin: 0;
  color: ${t => t.theme.gray5} !important;
`;

const ProjectItem = createReactClass({
  displayName: 'ProjectItem',

  propTypes: {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
  },

  mixins: [
    ApiMixin,
    TooltipMixin(function() {
      return {
        selector: '.tip',
        title: function(instance) {
          return this.getAttribute('data-isbookmarked') === 'true'
            ? 'Remove from bookmarks'
            : 'Add to bookmarks';
        },
      };
    }),
  ],

  getInitialState() {
    return {
      bookmarked: null,
    };
  },

  componentWillReceiveProps(nextProps) {
    // Local bookmarked state should be unset when the project data changes
    // Local state is used for optimistic UI update
    if (nextProps.project.isBookmarked !== this.props.project.isBookmarked) {
      this.setState({bookmarked: null});
    }
  },

  toggleBookmark() {
    let {project, organization} = this.props;

    this.setState({bookmarked: !project.isBookmarked}, () =>
      update(this.api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {
          isBookmarked: !project.isBookmarked,
        },
      })
    );
  },

  render() {
    let {project, organization} = this.props;
    let org = organization;
    let isBookmarked = this.state.bookmarked || project.isBookmarked;

    return (
      <div key={project.id} className={isBookmarked ? 'isBookmarked' : null}>
        <StyledH5>
          <a
            onClick={this.toggleBookmark}
            className="tip"
            data-isbookmarked={isBookmarked}
          >
            {isBookmarked ? (
              <span className="icon-star-solid bookmark" />
            ) : (
              <span className="icon-star-outline bookmark" />
            )}
          </a>
          <Link to={`/settings/organization/${org.slug}/project/${project.slug}/`}>
            <ProjectLabel project={project} organization={this.props.organization} />
          </Link>
        </StyledH5>
      </div>
    );
  },
});

export default ProjectItem;
