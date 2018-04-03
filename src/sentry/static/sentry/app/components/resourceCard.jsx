import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router';
import styled from 'react-emotion';

import ConfigStore from '../stores/configStore';

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
    flipImage: PropTypes.bool,
  };

  render() {
    const mediaUrl = ConfigStore.get('mediaUrl');
    let {title, link, imgUrl, flipImage} = this.props;

    return (
      <div className="box p-x-2 p-y-1">
        <Link to={link}>
          <div className="m-b-1">
            <img
              src={mediaUrl + imgUrl}
              alt={title}
              style={flipImage && {transform: 'scaleY(-1)'}}
            />
          </div>
          <StyledTitle>{title}</StyledTitle>
        </Link>
      </div>
    );
  }
}
