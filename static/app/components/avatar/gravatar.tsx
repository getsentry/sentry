import {Component} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ConfigStore from 'app/stores/configStore';
import {callIfFunction} from 'app/utils/callIfFunction';

import {imageStyle, ImageStyleProps} from './styles';

type Props = {
  remoteSize: number;
  gravatarId?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
} & ImageStyleProps;

type State = {
  MD5?: any;
};

class Gravatar extends Component<Props, State> {
  state: State = {
    MD5: undefined,
  };

  componentDidMount() {
    this._isMounted = true;

    import('crypto-js/md5')
      .then(mod => mod.default)
      .then(MD5 => {
        if (!this._isMounted) {
          return;
        }
        this.setState({MD5});
      });
  }

  componentWillUnmount() {
    // Need to track mounted state because `React.isMounted()` is deprecated and because of
    // dynamic imports
    this._isMounted = false;
  }

  private _isMounted: boolean = false;

  buildGravatarUrl = () => {
    const {gravatarId, remoteSize, placeholder} = this.props;
    let url = ConfigStore.getConfig().gravatarBaseUrl + '/avatar/';

    const md5 = callIfFunction(this.state.MD5, gravatarId);
    if (md5) {
      url += md5;
    }

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

    const {round, onError, onLoad, suggested, grayscale} = this.props;

    return (
      <Image
        round={round}
        src={this.buildGravatarUrl()}
        onLoad={onLoad}
        onError={onError}
        suggested={suggested}
        grayscale={grayscale}
      />
    );
  }
}

export default Gravatar;

const Image = styled('img')<ImageStyleProps>`
  ${imageStyle};
`;
