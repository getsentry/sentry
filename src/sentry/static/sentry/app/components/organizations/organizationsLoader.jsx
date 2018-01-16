import React from 'react';
import {connect} from 'react-redux';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

import ApiMixin from '../../mixins/apiMixin';
import OrganizationsStore from '../../stores/organizationsStore';

import {loadOrganizations} from '../../actionsRedux/organization';

const OrganizationsLoader = createReactClass({
  displayName: 'OrganizationsLoader',
  propTypes: {
    loadOrganizations: PropTypes.func.isRequired,
  },
  mixins: [ApiMixin],

  componentWillMount() {
    this.api.request('/organizations/', {
      query: {
        member: '1',
      },
      success: data => {
        // Load both redux and reflux stores for now
        OrganizationsStore.load(data);
        this.props.loadOrganizations(data);
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
    // Load both redux and reflux stores for now
    OrganizationsStore.load([]);
    this.props.loadOrganizations([]);
  },

  render() {
    return <div>{this.props.children}</div>;
  },
});

export default connect(state => state, {
  loadOrganizations,
})(OrganizationsLoader);
