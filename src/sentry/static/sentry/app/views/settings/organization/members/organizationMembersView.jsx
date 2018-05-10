import PropTypes from 'prop-types';
import React from 'react';
import {debounce} from 'lodash';
import idx from 'idx';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import ConfigStore from 'app/stores/configStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';

import OrganizationMembersPanel from './organizationMembersPanel';
import OrganizationAccessRequests from './organizationAccessRequests';

class OrganizationMembersView extends AsyncView {
  static propTypes = {
    routes: PropTypes.array,
  };

  static contextTypes = {
    router: PropTypes.object.isRequired,
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    return [
      [
        'authProvider',
        `/organizations/${this.props.params.orgId}/auth-provider/`,
        {},
        {
          allowError: error => {
            // Allow for 403s
            return error.status === 403;
          },
        },
      ],
    ];
  }

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Members`;
  }

  renderBody() {
    let {params, routes} = this.props;
    let {requestList} = this.state;
    let {organization} = this.context;
    let {access} = organization;
    let canAddMembers = access.indexOf('org:write') > -1;

    let action = (
      <Button
        priority="primary"
        size="small"
        disabled={!canAddMembers}
        title={
          !canAddMembers
            ? t('You do not have enough permission to add new members')
            : undefined
        }
        to={recreateRoute('new/', {routes, params})}
        icon="icon-circle-add"
      >
        {t('Invite Member')}
      </Button>
    );

    if (canAddMembers) {
      action = (
        <GuideAnchor target="member_add" type="invisible">
          {action}
        </GuideAnchor>
      );
    }

    return (
      <div>
        <SettingsPageHeader title="Members" action={action} />

        <OrganizationAccessRequests />

        <OrganizationMembersPanel
          organization={organization}
          authProvider={this.state.authProvider}
        />
      </div>
    );
  }
}

export default OrganizationMembersView;
