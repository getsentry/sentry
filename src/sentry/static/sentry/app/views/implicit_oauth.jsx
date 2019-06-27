import React from 'react';
import queryString from 'query-string';
import _ from 'lodash';

class ImplicitOauth extends React.Component {
  componentDidMount() {
    const hash = window.location.hash;

    if (String(hash).trim().length <= 0) {
      return;
    }

    const results = queryString.parse(hash);

    console.log('hash', results);

    if (!window.opener) {
      console.log('no window.opener');
      // this route was not opened as a new window by the stackexchange auth handler
      return;
    }

    const access_token = _.get(results, ['access_token']);

    if (
      !access_token ||
      !_.isString(access_token) ||
      String(access_token).trim().length <= 0
    ) {
      // TODO: error
      console.log('invalid access token');
      return;
    }

    localStorage.setItem('stackexchange_access_token', access_token);

    window.opener.postMessage(
      'stackexchange_implicit_oauth_flow_done',
      window.location.origin
    );
  }

  render() {
    return <div>ImplicitOauth</div>;
  }
}

export default ImplicitOauth;
