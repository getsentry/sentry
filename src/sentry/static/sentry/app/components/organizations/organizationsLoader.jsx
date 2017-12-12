import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import OrganizationsStore from '../../stores/organizationsStore';

const OrganizationsLoader = React.createClass({
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
