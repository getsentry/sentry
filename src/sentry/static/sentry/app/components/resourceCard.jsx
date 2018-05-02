import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import analytics from 'app/utils/analytics';
import ConfigStore from 'app/stores/configStore';
import ExternalLink from 'app/components/externalLink';

const StyledTitle = styled('div')`
  color: #493e54;
  font-size: 16px;
  text-align: center;
  font-weight: bold;
`;

export default class ResourceCard extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    imgUrl: PropTypes.string.isRequired,
  };

  recordClick = () => {
    let {link, title} = this.props;
    analytics('orgdash.resource_clicked', {link, title});
  };

  render() {
    const mediaUrl = ConfigStore.get('mediaUrl');
    let {title, link, imgUrl} = this.props;

    return (
      <div
        className="flex box p-x-2 p-y-1"
        style={{flexGrow: 1, alignItems: 'center'}}
        onClick={this.recordClick}
      >
        <ExternalLink href={link}>
          <div className="m-b-1">
            <img src={mediaUrl + imgUrl} alt={title} />
          </div>
          <StyledTitle>{title}</StyledTitle>
        </ExternalLink>
      </div>
    );
  }
}
