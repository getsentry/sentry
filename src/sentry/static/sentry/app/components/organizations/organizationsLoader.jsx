import React from 'react';
import PropTypes from 'prop-types';

import OrganizationsStore from 'app/stores/organizationsStore';
import withApi from 'app/utils/withApi';

class OrganizationsLoader extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
  };

  componentDidMount() {
    this.props.api.request('/organizations/', {
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
  }

  componentWillUnmount() {
    OrganizationsStore.load([]);
  }

  render() {
    return this.props.children;
  }
}

export default withApi(OrganizationsLoader);
