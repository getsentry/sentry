import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import ApiMixin from '../../mixins/apiMixin';
import {t} from '../../locale';

import {update as projectUpdate} from '../../actionCreators/projects';

const BookmarkToggle = createReactClass({
  displayName: 'BookmarkToggle',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    project: PropTypes.object.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      showMessage: false,
    };
  },

  handleBookmarkClick() {
    let {project} = this.props;

    if (!project.isBookmarked) {
      this.setState({showMessage: true});
    }

    projectUpdate(this.api, {
      orgId: this.props.orgId,
      projectId: project.slug,
      data: {
        isBookmarked: !project.isBookmarked,
      },
    });
  },

  renderMessage() {
    let {project} = this.props;
    let classNames = 'alert-inline alert-success ';

    if (this.state.showMessage) {
      classNames += ' show-message';
    }

    if (project.isBookmarked) {
      setTimeout(
        function() {
          this.setState({showMessage: false});
        }.bind(this),
        4000
      );
    }

    return <span className={classNames}>{t('Project starred')}</span>;
  },

  render() {
    // TODO: can't guarantee that a <span> is appropriate here 100% of the time
    //       if this is to be truly re-usable
    return <span onClick={this.handleBookmarkClick}>{this.props.children}</span>;
  },
});

export default BookmarkToggle;
