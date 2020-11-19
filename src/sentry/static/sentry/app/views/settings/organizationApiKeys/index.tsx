import {RouteComponentProps} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';
import React from 'react';

import {Organization} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import routeTitleGen from 'app/utils/routeTitle';
import recreateRoute from 'app/utils/recreateRoute';
import withOrganization from 'app/utils/withOrganization';

import OrganizationApiKeysList from './organizationApiKeysList';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = {
  keys: any[];
} & AsyncView['state'];

class OrganizationApiKeys extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['keys', `/organizations/${this.props.params.orgId}/api-keys/`]];
  }

  getTitle() {
    return routeTitleGen(t('API Keys'), this.props.organization.slug, false);
  }

  handleRemove = async (id: string) => {
    const oldKeys = [...this.state.keys];

    this.setState(state => ({
      keys: state.keys.filter(({id: existingId}) => existingId !== id),
    }));

    try {
      await this.api.requestPromise(
        `/organizations/${this.props.params.orgId}/api-keys/${id}/`,
        {
          method: 'DELETE',
          data: {},
        }
      );
    } catch {
      this.setState({keys: oldKeys, busy: false});
      addErrorMessage(t('Error removing key'));
    }
  };

  handleAddApiKey = async () => {
    this.setState({
      busy: true,
    });

    try {
      const data = await this.api.requestPromise(
        `/organizations/${this.props.params.orgId}/api-keys/`,
        {
          method: 'POST',
          data: {},
        }
      );

      if (data) {
        this.setState({busy: false});
        browserHistory.push(
          recreateRoute(`${data.id}/`, {
            params: this.props.params,
            routes: this.props.routes,
          })
        );
        addSuccessMessage(t(`Created a new API key "${data.label}"`));
      }
    } catch {
      this.setState({busy: false});
    }
  };

  renderBody() {
    const {organization, ...props} = this.props;
    return (
      <OrganizationApiKeysList
        busy={this.state.busy}
        keys={this.state.keys}
        organization={organization}
        onRemove={this.handleRemove}
        onAddApiKey={this.handleAddApiKey}
        {...props}
      />
    );
  }
}

export default withOrganization(OrganizationApiKeys);
