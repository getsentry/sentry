import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import ApiMixin from 'app/mixins/apiMixin';
import {update as projectUpdate} from 'app/actionCreators/projects';
import LatestContextStore from 'app/stores/latestContextStore';

const BookmarkToggle = createReactClass({
  displayName: 'BookmarkToggle',

  mixins: [ApiMixin, Reflux.connect(LatestContextStore, 'latestContext')],

  handleBookmarkClick() {
    let {project, organization} = this.state.latestContext;
    if (project && organization) {
      projectUpdate(this.api, {
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
    let project = this.state.latestContext.project;
    let isActive = project ? project.isBookmarked : false;

    let projectIconClass = classNames('project-select-bookmark icon icon-star-solid', {
      active: isActive,
    });

    return (
      <span onClick={this.handleBookmarkClick}>
        <a className={projectIconClass} />
      </span>
    );
  },
});

export default BookmarkToggle;
