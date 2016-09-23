import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import OrganizationStore from '../../stores/organizationStore';

const OrganizationsLoader = React.createClass({
  mixins: [ApiMixin],

  componentWillMount() {
    this.api.request('/organizations/', {
      query: {
        'member': '1'
      },
      success: (data) => {
        OrganizationStore.load(data);
        this.setState({
          loading: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  componentWillUnmount() {
    OrganizationStore.load([]);
  },

  render() {
    return <div>{this.props.children}</div>;
  }
});

export default OrganizationsLoader;
