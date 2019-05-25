import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import {update} from 'app/actionCreators/projects';
import withApi from 'app/utils/withApi';

class BookmarkStar extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    /* used to override when under local state */
    isBookmarked: PropTypes.bool,
    className: PropTypes.string,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    onToggle: PropTypes.func,
  };

  isBookmarked() {
    return defined(this.props.isBookmarked)
      ? this.props.isBookmarked
      : this.props.project.isBookmarked;
  }

  toggleProjectBookmark = event => {
    const {project, organization, api} = this.props;
    const isBookmarked = this.isBookmarked();

    update(api, {
      orgId: organization.slug,
      projectId: project.slug,
      data: {isBookmarked: !isBookmarked},
    }).catch(() => {
      addErrorMessage(t('Unable to toggle bookmark for %s', project.slug));
    });

    //needed to dismiss tooltip
    document.activeElement.blur();

    //prevent dropdowns from closing
    event.stopPropagation();

    if (this.props.onToggle) {
      this.props.onToggle(!isBookmarked);
    }
  };

  render() {
    const {className} = this.props;
    const isBookmarked = this.isBookmarked();

    return (
      <Star
        isBookmarked={isBookmarked}
        src="icon-star-small-filled"
        onClick={this.toggleProjectBookmark}
        className={className}
      />
    );
  }
}

const Star = styled(InlineSvg)`
  color: ${p => (p.isBookmarked ? p.theme.yellowOrange : p.theme.gray1)};

  &:hover {
    color: ${p => (p.isBookmarked ? p.theme.yellowOrangeLight : p.theme.gray2)};
  }
`;

export default withApi(BookmarkStar);
