import {Component} from 'react';
import {PlainRoute, RouteComponentProps} from 'react-router';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import HookOrDefault from 'sentry/components/hookOrDefault';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Sidebar from 'sentry/components/sidebar';
import SentryTypes from 'sentry/sentryTypes';
import {Organization} from 'sentry/types';
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

const OrganizationHeader = HookOrDefault({
  hookName: 'component:organization-header',
});

class OrganizationContextContainer extends Component<Props, State> {
  static childContextTypes = {
    organization: SentryTypes.Organization,
  };
  getChildContext() {
    return {
      organization: (window.__initialData as any).organization,
    };
  }
  render() {
    const organization = (window.__initialData as any).organization as Organization;
    console.log(organization);

    return (
      <SentryDocumentTitle noSuffix title={organization?.name ?? 'Sentry'}>
        <OrganizationContext.Provider value={organization}>
          <div className="app">
            <OrganizationHeader organization={organization} />
            {this.props.includeSidebar ? <Sidebar organization={organization} /> : null}
            {this.props.children}
          </div>
        </OrganizationContext.Provider>
      </SentryDocumentTitle>
    );
  }
}

export default withApi(
  withOrganizations(Sentry.withProfiler(OrganizationContextContainer))
);

export {OrganizationContextContainer as OrganizationLegacyContext};
