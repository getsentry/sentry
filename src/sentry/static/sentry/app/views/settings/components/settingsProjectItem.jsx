import styled from 'react-emotion';
import React from 'react';
import createReactClass from 'create-react-class';

import {update} from 'app/actionCreators/projects';
import ApiMixin from 'app/mixins/apiMixin';
import Tooltip from 'app/components/tooltip';

import Link from 'app/components/link';
import ProjectLabel from 'app/components/projectLabel';
import SentryTypes from 'app/sentryTypes';

const InlineButton = styled('button')`
  color: ${p => p.theme.gray1};
  border: none;
  background-color: inherit;
  padding: 0;
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

  handleToggleBookmark() {
    const {project, organization} = this.props;
    const {isBookmarked} = this.state;

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
    const {project, organization} = this.props;
    const {isBookmarked} = this.state;

    const hasNewRoutes = new Set(organization.features).has('sentry10');

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
        <Link
          to={
            hasNewRoutes
              ? `/settings/${organization.slug}/projects/${project.slug}/`
              : `/${organization.slug}/${project.slug}/`
          }
        >
          <ProjectLabel project={project} />
        </Link>
      </div>
    );
  },
});

export default ProjectItem;
