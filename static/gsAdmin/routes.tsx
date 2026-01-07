import type {SentryRouteObject} from 'sentry/router/types';
import {translateSentryRoute} from 'sentry/utils/reactRouter6Compat/router';

import BeaconDetails from 'admin/views/beaconDetails';
import Beacons from 'admin/views/beacons';
import BillingAdmins from 'admin/views/billingAdmins';
import BillingPlans from 'admin/views/billingPlans';
import BroadcastDetails from 'admin/views/broadcastDetails';
import Broadcasts from 'admin/views/broadcasts';
import CustomerDetails from 'admin/views/customerDetails';
import Customers from 'admin/views/customers';
import CustomerUpgradeRequest from 'admin/views/customerUpgradeRequest';
import DataRequests from 'admin/views/dataRequests';
import DebuggingTools from 'admin/views/debuggingTools';
import DocIntegrationDetails from 'admin/views/docIntegrationDetails';
import DocIntegrations from 'admin/views/docIntegrations';
import GenerateSpikeProjectionsForBatch from 'admin/views/generateSpikeProjectionsForBatch';
import Home from 'admin/views/home';
import InstanceLevelOAuth from 'admin/views/instanceLevelOAuth/instanceLevelOAuth';
import InstanceLevelOAuthDetails from 'admin/views/instanceLevelOAuth/instanceLevelOAuthDetails';
import InvoiceDetails from 'admin/views/invoiceDetails';
import Invoices from 'admin/views/invoices';
import LaunchpadAdminPage from 'admin/views/launchpadAdminPage';
import Layout from 'admin/views/layout';
import NotFound from 'admin/views/notFound';
import Options from 'admin/views/options';
import Policies from 'admin/views/policies';
import PolicyDetails from 'admin/views/policyDetails';
import PrivateAPIs from 'admin/views/privateAPIs';
import ProjectDetails from 'admin/views/projectDetails';
import PromoCodeDetails from 'admin/views/promoCodeDetails';
import PromoCodes from 'admin/views/promoCodes';
import RelocationArtifactDetails from 'admin/views/relocationArtifactDetails';
import RelocationCreate from 'admin/views/relocationCreate';
import RelocationDetails from 'admin/views/relocationDetails';
import Relocations from 'admin/views/relocations';
import SentryAppDetails from 'admin/views/sentryAppDetails';
import SentryApps from 'admin/views/sentryApps';
import SentryEmployees from 'admin/views/sentryEmployees';
import UserDetails from 'admin/views/userDetails';
import Users from 'admin/views/users';

function buildRoutes() {
  const routes: SentryRouteObject = {
    path: '/_admin/',
    component: Layout,
    children: [
      {
        index: true,
        component: Home,
        deprecatedRouteProps: true,
      },
      {
        path: 'beacons/',
        children: [
          {
            index: true,
            component: Beacons,
            deprecatedRouteProps: true,
          },
          {
            path: ':beaconId/',
            component: BeaconDetails,
            deprecatedRouteProps: true,
          },
        ],
      },
      {
        path: 'broadcasts/',
        children: [
          {
            index: true,
            component: Broadcasts,
            deprecatedRouteProps: true,
          },
          {
            path: ':broadcastId/',
            component: BroadcastDetails,
            deprecatedRouteProps: true,
          },
        ],
      },
      {
        path: 'customers/',
        children: [
          {
            index: true,
            component: Customers,
            deprecatedRouteProps: true,
          },
          {
            path: ':orgId/',
            children: [
              {
                index: true,
                component: CustomerDetails,
              },
              {
                path: 'upgrade-request/',
                component: CustomerUpgradeRequest,
              },
              {
                path: 'projects/:projectId/',
                component: ProjectDetails,
              },
              {
                path: 'invoices/:region/:invoiceId/',
                component: InvoiceDetails,
              },
            ],
          },
        ],
      },
      {
        path: 'doc-integrations/',
        children: [
          {
            index: true,
            component: DocIntegrations,
            deprecatedRouteProps: true,
          },
          {
            path: ':docIntegrationSlug/',
            component: DocIntegrationDetails,
          },
        ],
      },
      {
        path: 'debugging-tools/',
        children: [
          {
            index: true,
            component: DebuggingTools,
          },
        ],
      },
      {
        path: 'policies/',
        children: [
          {
            index: true,
            component: Policies,
            deprecatedRouteProps: true,
          },
          {
            path: ':policySlug',
            component: PolicyDetails,
            deprecatedRouteProps: true,
          },
        ],
      },
      {
        path: 'private-apis/',
        children: [
          {
            index: true,
            component: PrivateAPIs,
          },
        ],
      },
      {
        path: 'relocations/',
        children: [
          {
            index: true,
            component: Relocations,
            deprecatedRouteProps: true,
          },
          {
            path: 'new/',
            component: RelocationCreate,
          },
          {
            path: ':regionName/:relocationUuid/',
            component: RelocationDetails,
          },
          {
            path: ':regionName/:relocationUuid/:artifactKind/:fileName/',
            component: RelocationArtifactDetails,
          },
        ],
      },
      {
        path: 'employees/',
        children: [
          {
            index: true,
            component: SentryEmployees,
            deprecatedRouteProps: true,
          },
        ],
      },
      {
        path: 'promocodes/',
        children: [
          {
            index: true,
            component: PromoCodes,
            deprecatedRouteProps: true,
          },
          {
            path: ':codeId/',
            component: PromoCodeDetails,
          },
        ],
      },
      {
        path: 'sentry-apps/',
        children: [
          {
            index: true,
            component: SentryApps,
            deprecatedRouteProps: true,
          },
          {
            path: ':sentryAppSlug/',
            component: SentryAppDetails,
          },
        ],
      },
      {
        path: 'users/',
        children: [
          {
            index: true,
            component: Users,
            deprecatedRouteProps: true,
          },
          {
            path: ':userId/',
            component: UserDetails,
          },
        ],
      },
      {
        path: 'options/',
        children: [
          {
            index: true,
            component: Options,
            deprecatedRouteProps: true,
          },
        ],
      },
      {
        path: 'data-requests/',
        component: DataRequests,
      },
      {
        path: 'billingadmins/',
        component: BillingAdmins,
        deprecatedRouteProps: true,
      },
      {
        path: 'invoices/',
        children: [
          {
            index: true,
            component: Invoices,
            deprecatedRouteProps: true,
          },
          {
            path: ':invoiceId/',
            component: InvoiceDetails,
          },
        ],
      },
      {
        path: 'instance-level-oauth',
        children: [
          {
            index: true,
            component: InstanceLevelOAuth,
          },
          {
            path: ':clientID/',
            component: InstanceLevelOAuthDetails,
          },
        ],
      },
      {
        path: 'billing-plans/',
        children: [
          {
            index: true,
            component: BillingPlans,
          },
        ],
      },
      {
        path: 'spike-projection-generation/',
        children: [
          {
            index: true,
            component: GenerateSpikeProjectionsForBatch,
          },
        ],
      },
      {
        path: 'launchpad/',
        children: [
          {
            index: true,
            component: LaunchpadAdminPage,
          },
        ],
      },
      {
        path: '*',
        component: NotFound,
      },
    ],
  };

  return [translateSentryRoute(routes)];
}

export const routes = buildRoutes();
