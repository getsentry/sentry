import {browserHistory, RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

import OrganizationApiKeysList from './organizationApiKeysList';
import {DeprecatedApiKey} from './types';

type Props = RouteComponentProps<{}, {}> & {
  organization: Organization;
};

type State = {
  keys: DeprecatedApiKey[];
} & DeprecatedAsyncView['state'];

/**
 * API Keys are deprecated, but there may be some legacy customers that still use it
 */
class OrganizationApiKeys extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    return [['keys', `/organizations/${organization.slug}/api-keys/`]];
  }

  getTitle() {
    return routeTitleGen(t('API Keys'), this.props.organization.slug, false);
  }

  handleRemove = async (id: string) => {
    const {organization} = this.props;
    const oldKeys = [...this.state.keys];

    this.setState(state => ({
      keys: state.keys.filter(({id: existingId}) => existingId !== id),
    }));

    try {
      await this.api.requestPromise(
        `/organizations/${organization.slug}/api-keys/${id}/`,
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
    const {organization} = this.props;

    try {
      const data = await this.api.requestPromise(
        `/organizations/${organization.slug}/api-keys/`,
        {
          method: 'POST',
          data: {},
        }
      );

      if (data) {
        this.setState({busy: false});
        browserHistory.push(
          recreateRoute(`${data.id}/`, {
            params: {orgId: organization.slug},
            routes: this.props.routes,
          })
        );
        addSuccessMessage(t('Created a new API key "%s"', data.label));
      }
    } catch {
      this.setState({busy: false});
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization} = this.props;
    const params = {orgId: organization.slug};

    return (
      <OrganizationApiKeysList
        {...this.props}
        params={params}
        loading={this.state.loading}
        busy={this.state.busy}
        keys={this.state.keys}
        onRemove={this.handleRemove}
        onAddApiKey={this.handleAddApiKey}
      />
    );
  }
}

export default withOrganization(OrganizationApiKeys);
