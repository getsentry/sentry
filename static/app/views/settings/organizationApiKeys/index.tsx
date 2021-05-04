import {browserHistory, RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import recreateRoute from 'app/utils/recreateRoute';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

import OrganizationApiKeysList from './organizationApiKeysList';
import {DeprecatedApiKey} from './types';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = {
  keys: DeprecatedApiKey[];
} & AsyncView['state'];

/**
 * API Keys are deprecated, but there may be some legacy customers that still use it
 */
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

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return (
      <OrganizationApiKeysList
        loading={this.state.loading}
        busy={this.state.busy}
        keys={this.state.keys}
        onRemove={this.handleRemove}
        onAddApiKey={this.handleAddApiKey}
        {...this.props}
      />
    );
  }
}

export default withOrganization(OrganizationApiKeys);
