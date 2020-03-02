import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';
import createReactClass from 'create-react-class';

import withApi from 'app/utils/withApi';
import {update as projectUpdate} from 'app/actionCreators/projects';
import LatestContextStore from 'app/stores/latestContextStore';

const BookmarkToggle = createReactClass({
  displayName: 'BookmarkToggle',
  propTypes: {
    api: PropTypes.object,
  },
  mixins: [Reflux.connect(LatestContextStore, 'latestContext')],

  handleBookmarkClick() {
    const {project, organization} = this.state.latestContext;
    if (project && organization) {
      projectUpdate(this.props.api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {
          isBookmarked: !project.isBookmarked,
        },
      });
    }
  },

  render() {
    // TODO: can't guarantee that a <span> is appropriate here 100% of the time
    //       if this is to be truly re-usable
    const project = this.state.latestContext.project;
    const isActive = project ? project.isBookmarked : false;

    const projectIconClass = classNames('project-select-bookmark icon icon-star-solid', {
      active: isActive,
    });

    return (
      <span onClick={this.handleBookmarkClick}>
        <a className={projectIconClass} />
      </span>
    );
  },
});

export {BookmarkToggle};

export default withApi(BookmarkToggle);
