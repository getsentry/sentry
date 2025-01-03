import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import recreateRoute from 'sentry/utils/recreateRoute';
import withOrganization from 'sentry/utils/withOrganization';

import OrganizationApiKeysList from './organizationApiKeysList';
import type {DeprecatedApiKey} from './types';

type Props = RouteComponentProps<{}, {}> & {
  organization: Organization;
};

type State = {
  keys: DeprecatedApiKey[];
} & DeprecatedAsyncComponent['state'];

/**
 * API Keys are deprecated, but there may be some legacy customers that still use it
 */
class OrganizationApiKeys extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [['keys', `/organizations/${organization.slug}/api-keys/`]];
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
      <SentryDocumentTitle title={t('Api Keys')} orgSlug={organization.slug}>
        <OrganizationApiKeysList
          {...this.props}
          params={params}
          loading={this.state.loading}
          busy={this.state.busy}
          keys={this.state.keys}
          onRemove={this.handleRemove}
          onAddApiKey={this.handleAddApiKey}
        />
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(OrganizationApiKeys);
