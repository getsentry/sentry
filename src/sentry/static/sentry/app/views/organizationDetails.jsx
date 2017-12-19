import React from 'react';

import OrganizationContext from './organizationContext';

import Footer from '../components/footer';
import Sidebar from '../components/sidebar';

class OrganizationDetails extends React.Component {
  render() {
    return (
      <OrganizationContext {...this.props}>
        <Sidebar />
        {this.props.children}
        <Footer />
      </OrganizationContext>
    );
  }
}

export default OrganizationDetails;
