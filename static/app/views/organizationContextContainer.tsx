import {Component, Fragment} from 'react';
import {PlainRoute, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingTriangle from 'sentry/components/loadingTriangle';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Sidebar from 'sentry/components/sidebar';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import SentryTypes from 'sentry/sentryTypes';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import RequestError from 'sentry/utils/requestError/requestError';
import withApi from 'sentry/utils/withApi';
import withOrganizations from 'sentry/utils/withOrganizations';

import {OrganizationContext} from './organizationContext';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  api: Client;
  includeSidebar: boolean;
  organizations: Organization[];
  organizationsLoading: boolean;
  routes: PlainRoute[];
  useLastOrganization: boolean;
  children?: React.ReactNode;
};

type State = {
  loading: boolean;
  organization: Organization | null;
  prevProps: {
    location: Props['location'];
    orgId: string;
    organizationsLoading: boolean;
  };
  dirty?: boolean;
  error?: RequestError | null;
  errorType?: string | null;
  hooks?: React.ReactNode[];
};

class OrganizationContextContainer extends Component<Props, State> {
  static getDerivedStateFromProps(props: Readonly<Props>, prevState: State): State {
    const {prevProps} = prevState;

    if (OrganizationContextContainer.shouldRemount(prevProps, props)) {
      return OrganizationContextContainer.getDefaultState(props);
    }

    const {organizationsLoading, location, params} = props;
    const {orgId} = params;
    return {
      ...prevState,
      prevProps: {
        orgId,
        organizationsLoading,
        location,
      },
    };
  }

  static shouldRemount(prevProps: State['prevProps'], props: Props): boolean {
    const hasOrgIdAndChanged =
      prevProps.orgId && props.params.orgId && prevProps.orgId !== props.params.orgId;

    const hasOrgId =
      props.params.orgId ||
      (props.useLastOrganization && ConfigStore.get('lastOrganization'));

    // protect against the case where we finish fetching org details
    // and then `OrganizationsStore` finishes loading:
    // only fetch in the case where we don't have an orgId
    //
    // Compare `getOrganizationSlug`  because we may have a last used org from server
    // if there is no orgId in the URL
    const organizationLoadingChanged =
      prevProps.organizationsLoading !== props.organizationsLoading &&
      props.organizationsLoading === false;

    return (
      hasOrgIdAndChanged ||
      (!hasOrgId && organizationLoadingChanged) ||
      (props.location.state === 'refresh' && prevProps.location.state !== 'refresh')
    );
  }

  static getDefaultState(props: Props): State {
    const prevProps = {
      orgId: props.params.orgId,
      organizationsLoading: props.organizationsLoading,
      location: props.location,
    };

    if (OrganizationContextContainer.isOrgStorePopulatedCorrectly(props)) {
      // retrieve initial state from store
      return {
        ...OrganizationStore.get(),
        prevProps,
      };
    }

    return {
      loading: true,
      error: null,
      errorType: null,
      organization: null,
      prevProps,
    };
  }

  static getOrganizationSlug(props: Props) {
    return (
      props.params.orgId ||
      ((props.useLastOrganization &&
        (ConfigStore.get('lastOrganization') ||
          props.organizations?.[0]?.slug)) as string)
    );
  }

  static isOrgChanging(props: Props): boolean {
    const {organization} = OrganizationStore.get();

    if (!organization) {
      return false;
    }

    return organization.slug !== OrganizationContextContainer.getOrganizationSlug(props);
  }

  static isOrgStorePopulatedCorrectly(props: Props) {
    const {organization, dirty} = OrganizationStore.get();

    return !dirty && organization && !OrganizationContextContainer.isOrgChanging(props);
  }

  static childContextTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(props: Props) {
    super(props);
    this.state = OrganizationContextContainer.getDefaultState(props);
  }

  getChildContext() {
    return {
      organization: this.state.organization,
    };
  }

  componentDidMount() {
    this.fetchData(true);
  }

  componentDidUpdate(prevProps: Props) {
    const remountPrevProps: State['prevProps'] = {
      orgId: prevProps.params.orgId,
      organizationsLoading: prevProps.organizationsLoading,
      location: prevProps.location,
    };

    if (OrganizationContextContainer.shouldRemount(remountPrevProps, this.props)) {
      this.remountComponent();
    }
  }

  componentWillUnmount() {
    this.unlisteners.forEach(callIfFunction);
  }

  unlisteners = [
    OrganizationStore.listen(data => this.loadOrganization(data), undefined),
  ];

  remountComponent = () => {
    this.setState(
      OrganizationContextContainer.getDefaultState(this.props),
      this.fetchData
    );
  };

  isLoading() {
    // In the absence of an organization slug, the loading state should be
    // derived from this.props.organizationsLoading from OrganizationsStore
    if (!OrganizationContextContainer.getOrganizationSlug(this.props)) {
      return this.props.organizationsLoading;
    }

    return this.state.loading;
  }

  fetchData(isInitialFetch = false) {
    const orgSlug = OrganizationContextContainer.getOrganizationSlug(this.props);

    if (!orgSlug) {
      return;
    }

    // fetch from the store, then fetch from the API if necessary
    if (OrganizationContextContainer.isOrgStorePopulatedCorrectly(this.props)) {
      return;
    }

    metric.mark({name: 'organization-details-fetch-start'});
    fetchOrganizationDetails(
      this.props.api,
      orgSlug,
      !OrganizationContextContainer.isOrgChanging(this.props), // if true, will preserve a lightweight org that was fetched,
      isInitialFetch
    );
  }

  loadOrganization(orgData: State) {
    const {organization, error} = orgData;
    const hooks: React.ReactNode[] = [];

    if (organization && !error) {
      HookStore.get('organization:header').forEach(cb => {
        hooks.push(cb(organization));
      });

      // Configure scope to have organization tag
      Sentry.configureScope(scope => {
        // XXX(dcramer): this is duplicated in sdk.py on the backend
        scope.setTag('organization', organization.id);
        scope.setTag('organization.slug', organization.slug);
        scope.setContext('organization', {id: organization.id, slug: organization.slug});
      });
    } else if (error) {
      // If user is superuser, open sudo window
      const user = ConfigStore.get('user');
      if (!user || !user.isSuperuser || error.status !== 403) {
        // This `catch` can swallow up errors in development (and tests)
        // So let's log them. This may create some noise, especially the test case where
        // we specifically test this branch
        console.error(error); // eslint-disable-line no-console
      } else {
        openSudo({
          retryRequest: () => Promise.resolve(this.fetchData()),
          isSuperuser: true,
          needsReload: true,
        });
      }
    }

    this.setState({...orgData, hooks}, () => {
      // Take a measurement for when organization details are done loading and the new state is applied
      if (organization) {
        metric.measure({
          name: 'app.component.perf',
          start: 'organization-details-fetch-start',
          data: {
            name: 'org-details',
            route: getRouteStringFromRoutes(this.props.routes),
            organization_id: parseInt(organization.id, 10),
          },
        });
      }
    });
  }

  getTitle() {
    return this.state.organization?.name ?? 'Sentry';
  }

  renderSidebar(): React.ReactNode {
    if (!this.props.includeSidebar) {
      return null;
    }

    return <Sidebar organization={this.state.organization as Organization} />;
  }

  renderError() {
    let errorComponent: React.ReactElement;

    switch (this.state.errorType) {
      case ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS:
        // We can still render when an org can't be loaded due to 401. The
        // backend will handle redirects when this is a problem.
        return this.renderBody();
      case ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND:
        errorComponent = (
          <Alert type="error" data-test-id="org-loading-error">
            {t('The organization you were looking for was not found.')}
          </Alert>
        );
        break;
      default:
        errorComponent = <LoadingError onRetry={this.remountComponent} />;
    }

    return <ErrorWrapper>{errorComponent}</ErrorWrapper>;
  }

  renderBody() {
    return (
      <SentryDocumentTitle noSuffix title={this.getTitle()}>
        <OrganizationContext.Provider value={this.state.organization}>
          <div className="app">
            {this.state.hooks}
            {this.renderSidebar()}
            {this.props.children}
          </div>
        </OrganizationContext.Provider>
      </SentryDocumentTitle>
    );
  }

  render() {
    if (this.isLoading()) {
      return (
        <LoadingTriangle>{t('Loading data for your organization.')}</LoadingTriangle>
      );
    }

    if (this.state.error) {
      return (
        <Fragment>
          {this.renderSidebar()}
          {this.renderError()}
        </Fragment>
      );
    }

    return this.renderBody();
  }
}

export default withApi(
  withOrganizations(Sentry.withProfiler(OrganizationContextContainer))
);

export {OrganizationContextContainer as OrganizationLegacyContext};

const ErrorWrapper = styled('div')`
  padding: ${space(3)};
`;
