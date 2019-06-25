import React from 'react';
import _ from 'lodash';

import {generateRequest} from './utils';

class StackExchangeSites extends React.Component {
  state = {
    sites: [],
    loading: true,
    error: null,

    authenticated: false,
    ready: false,

    currentSite: {
      name: 'Stack Overflow',
      api_site_parameter: 'stackoverflow',
      icon: 'https://cdn.sstatic.net/Sites/stackoverflow/img/apple-touch-icon.png',
      site_url: 'https://stackoverflow.com',
    },
  };

  // eslint-disable-next-line react/sort-comp
  _isMounted = false;

  async componentDidMount() {
    this._isMounted = true;

    const authenticated = await this.checkAccessToken();

    const statePayload = await this.fetchData();

    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({
      authenticated,
      ready: true,
      ...statePayload,
    });
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  checkAccessToken = () => {
    // returns true if user is authenticated, false otherwise
    return new Promise(resolve => {
      const expected_access_token = localStorage.getItem('stackexchange_access_token');

      if (!expected_access_token) {
        localStorage.removeItem('stackexchange_access_token');
        resolve(false);
        return;
      }

      const request = generateRequest({
        url: `https://api.stackexchange.com/2.2/access-tokens/${expected_access_token}`,
        method: 'GET',
      });

      $.ajax(request)
        .then(results => {
          if (!this._isMounted) {
            return;
          }

          const actual_access_token = _.get(results, ['items', '0', 'access_token']);

          const authenticated = actual_access_token === expected_access_token;

          resolve(authenticated);
          return;
        })
        .fail(err => {
          if (!this._isMounted) {
            return;
          }

          const error_id = _.get(err, 'responseJSON.error_id');

          if (error_id === 403) {
            // invalid access token
            localStorage.removeItem('stackexchange_access_token');
          }

          resolve(false);
          return;
        });
    });
  };

  fetchData = () => {
    const request = generateRequest({
      url: 'https://api.stackexchange.com/2.2/sites',
      method: 'GET',
    });

    return new Promise(resolve => {
      // We can't use the API client here since the URL is not scoped under the
      // API endpoints (which the client prefixes)
      $.ajax(request)
        .then(results => {
          if (!this._isMounted) {
            return;
          }

          resolve({
            sites: results.items,
            loading: false,
            error: null,
          });
          return;
        })
        .fail(err => {
          if (!this._isMounted) {
            return;
          }

          resolve({
            sites: [],
            loading: false,
            error: err,
          });
          return;
        });
    });
  };

  onSelect = ({value}) => {
    const site = value;
    this.setState({
      currentSite: {
        name: site.name,
        api_site_parameter: site.api_site_parameter,
        icon: site.icon_url,
        site_url: site.site_url,
      },
    });
  };

  generateMenuList = () => {
    return this.state.sites.map(site => {
      return {
        value: site,
        searchKey: site.name,
        label: (
          <span>
            <img height="20" width="20" src={site.icon_url} /> {String(site.name)}
          </span>
        ),
      };
    });
  };

  hasAuthenticated = () => {
    this.setState({
      authenticated: true,
    });
  };

  render() {
    if (this.state.loading) {
      return null;
    }

    if (!!this.state.error) {
      return null;
    }

    const childProps = {
      sites: this.state.sites,
      menuList: this.generateMenuList(),
      onSelect: this.onSelect,
      currentSite: this.state.currentSite,
      authenticated: this.state.authenticated,
      hasAuthenticated: this.hasAuthenticated,
    };

    return this.props.children(childProps);
  }
}

export default StackExchangeSites;
