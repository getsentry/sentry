import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router';

import ConfigStore from '../stores/configStore';

export default class ResourceCard extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    imgUrl: PropTypes.string.isRequired,
  };

  render() {
    const mediaUrl = ConfigStore.get('mediaUrl');
    let {title, link, imgUrl} = this.props;

    return (
      <div className="box" style={{padding: '10px 20px 20px'}}>
        <Link to={link}>
          <div
            style={{
              color: '#493e54',
              fontSize: '16px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <b>{title}</b>
          </div>
          <div>
            <img src={mediaUrl + imgUrl} alt={title} />
          </div>
        </Link>
      </div>
    );
  }
}
