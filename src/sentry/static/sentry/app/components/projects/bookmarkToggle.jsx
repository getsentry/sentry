import React from 'react';

import ApiMixin from '../../mixins/apiMixin';

import {update as projectUpdate} from '../../actionCreators/projects';

const BookmarkToggle = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    project: React.PropTypes.object.isRequired,
  },

  mixins: [
    ApiMixin
  ],

  handleBookmarkClick() {
    let {project} = this.props;
    projectUpdate(this.api, {
      orgId: this.props.orgId,
      projectId: project.slug,
      data: {
        isBookmarked: !project.isBookmarked
      }
    });
  },

  render() {
    // TODO: can't guarantee that a <span> is appropriate here 100% of the time
    //       if this is to be truly re-usable
    return (
      <span onClick={this.handleBookmarkClick}>
        {this.props.children}
      </span>
    );

  }
});

export default BookmarkToggle;
