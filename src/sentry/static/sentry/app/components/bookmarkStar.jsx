import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import Tooltip from 'app/components/tooltip';
import {update} from 'app/actionCreators/projects';
import withApi from 'app/utils/withApi';

class BookmarkStar extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    className: PropTypes.string,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
  };

  constructor(props, context) {
    super(props, context);

    this.state = {
      isBookmarked: this.props.project.isBookmarked,
    };
  }

  toggleProjectBookmark = event => {
    const {project, organization, api} = this.props;

    this.setState({isBookmarked: !this.state.isBookmarked}, () => {
      update(api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {isBookmarked: this.state.isBookmarked},
      }).catch(() => {
        addErrorMessage(t('Unable to toggle bookmark for %s', project.slug));
      });
    });

    //needed to dismiss tooltip
    document.activeElement.blur();

    //prevent dropdowns from closing
    event.stopPropagation();
  };

  render() {
    const {className} = this.props;
    const {isBookmarked} = this.state;

    return (
      <Tooltip
        isBookmarked={isBookmarked}
        title={isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
      >
        <Star
          isBookmarked={isBookmarked}
          src="icon-star-small-filled"
          onClick={this.toggleProjectBookmark}
          className={className}
        />
      </Tooltip>
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
