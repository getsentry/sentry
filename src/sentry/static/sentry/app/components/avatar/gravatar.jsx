import PropTypes from 'prop-types';
import React from 'react';
import qs from 'query-string';
import styled from 'react-emotion';

import ConfigStore from 'app/stores/configStore';

import {imageStyle} from './styles';

class Gravatar extends React.Component {
  static propTypes = {
    remoteSize: PropTypes.number,
    gravatarId: PropTypes.string,
    placeholder: PropTypes.string,
    /**
     * Should avatar be round instead of a square
     */
    round: PropTypes.bool,
  };

  static defaultProps = {};

  constructor(props) {
    super(props);
    this.state = {
      MD5: null,
    };
  }

  componentDidMount() {
    this._isMounted = true;

    import(/* webpackChunkName: "MD5" */ 'crypto-js/md5')
      .then(mod => mod.default)
      .then(MD5 => {
        if (!this._isMounted) return;
        this.setState({MD5});
      });
  }

  componentWillUnmount() {
    // Need to track mounted state because `React.isMounted()` is deprecated and because of
    // dynamic imports
    this._isMounted = false;
  }

  buildGravatarUrl = () => {
    const {gravatarId, remoteSize, placeholder} = this.props;
    let url = ConfigStore.getConfig().gravatarBaseUrl + '/avatar/';

    url += this.state.MD5(gravatarId);

    const query = {
      s: remoteSize || undefined,
      // If gravatar is not found we need the request to return an error,
      // otherwise error handler will not trigger and avatar will not have a display a LetterAvatar backup.
      d: placeholder || '404',
    };

    url += '?' + qs.stringify(query);

    return url;
  };

  render() {
    if (!this.state.MD5) {
      return null;
    }

    const {round, ...props} = this.props;

    return <Image round={round} src={this.buildGravatarUrl()} {...props} />;
  }
}

export default Gravatar;

const Image = styled('img')`
  ${imageStyle};
`;
