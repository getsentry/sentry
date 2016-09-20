import React from 'react';

import ApiMixin from '../../mixins/apimixin';

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
    return (
      <div onClick={this.handleBookmarkClick}>
        {this.props.children}
      </div>
    );

  }
});

export default BookmarkToggle;
