import React from 'react';

import createReactClass from 'create-react-class';

import ApiMixin from 'app/mixins/apiMixin';
import OrganizationsStore from 'app/stores/organizationsStore';

const OrganizationsLoader = createReactClass({
  displayName: 'OrganizationsLoader',
  mixins: [ApiMixin],

  componentWillMount() {
    this.api.request('/organizations/', {
      query: {
        member: '1',
      },
      success: data => {
        OrganizationsStore.load(data);
        this.setState({
          loading: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  componentWillUnmount() {
    OrganizationsStore.load([]);
  },

  render() {
    return <div>{this.props.children}</div>;
  },
});

export default OrganizationsLoader;
