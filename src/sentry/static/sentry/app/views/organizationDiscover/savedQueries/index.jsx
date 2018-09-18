import React from 'react';
import PropTypes from 'prop-types';

// import SentryTypes from 'app/sentryTypes';

import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';

import {SidebarHeader, SidebarTitle, SidebarToggle, Fieldset} from '../styles';

export default class SavedQueries extends React.Component {
  static propTypes = {
    // organization: SentryTypes.Organization.isRequired,
    // queryBuilder: PropTypes.object.isRequired,
    toggleSidebar: PropTypes.func.isRequired,
  };

  renderLoading() {
    return <LoadingIndicator />;
  }

  renderEmpty() {
    return <Fieldset>{t('No saved searches')}</Fieldset>;
  }

  render() {
    const {toggleSidebar} = this.props;

    return (
      <React.Fragment>
        <SidebarHeader>
          <SidebarTitle>{t('Saved Queries')}</SidebarTitle>
        </SidebarHeader>
        {this.renderEmpty()}
        <Fieldset>
          <SidebarToggle onClick={toggleSidebar}>{t('View query builder')}</SidebarToggle>
        </Fieldset>
      </React.Fragment>
    );
  }
}
