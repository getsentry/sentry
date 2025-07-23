import {IndexRoute, Route} from 'sentry/components/route';
import {buildReactRouter6Routes} from 'sentry/utils/reactRouter6Compat/router';

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
  return (
    <Route path="/_admin/" component={Layout}>
      <IndexRoute component={Home} />

      <Route path="beacons/">
        <IndexRoute component={Beacons} />
        <Route path=":beaconId/" component={BeaconDetails} />
      </Route>

      <Route path="broadcasts/">
        <IndexRoute component={Broadcasts} />
        <Route path=":broadcastId/" component={BroadcastDetails} />
      </Route>

      <Route path="customers/">
        <IndexRoute component={Customers} />
        <Route path=":orgId/">
          <IndexRoute component={CustomerDetails} />
          <Route path="upgrade-request/" component={CustomerUpgradeRequest} />
          <Route path="projects/:projectId/" component={ProjectDetails} />
          <Route path="invoices/:region/:invoiceId/" component={InvoiceDetails} />
        </Route>
      </Route>

      <Route path="doc-integrations/">
        <IndexRoute component={DocIntegrations} />
        <Route path=":docIntegrationSlug/" component={DocIntegrationDetails} />
      </Route>
      <Route path="debugging-tools/">
        <IndexRoute component={DebuggingTools} />
      </Route>
      <Route path="policies/">
        <IndexRoute component={Policies} />
        <Route path=":policySlug" component={PolicyDetails} />
      </Route>

      <Route path="private-apis/">
        <IndexRoute component={PrivateAPIs} />
      </Route>

      <Route path="relocations/">
        <IndexRoute component={Relocations} />
        <Route path="new/" component={RelocationCreate} />
        <Route path=":regionName/:relocationUuid/" component={RelocationDetails} />
        <Route
          path=":regionName/:relocationUuid/:artifactKind/:fileName/"
          component={RelocationArtifactDetails}
        />
      </Route>

      <Route path="employees/">
        <IndexRoute component={SentryEmployees} />
      </Route>

      <Route path="promocodes/">
        <IndexRoute component={PromoCodes} />
        <Route path=":codeId/" component={PromoCodeDetails} />
      </Route>

      <Route path="sentry-apps/">
        <IndexRoute component={SentryApps} />
        <Route path=":sentryAppSlug/" component={SentryAppDetails} />
      </Route>

      <Route path="users/">
        <IndexRoute component={Users} />
        <Route path=":userId/" component={UserDetails} />
      </Route>

      <Route path="options/">
        <IndexRoute component={Options} />
      </Route>
      <Route path="data-requests/" component={DataRequests} />
      <Route path="billingadmins/" component={BillingAdmins} />

      <Route path="invoices/">
        <IndexRoute component={Invoices} />
        <Route path=":invoiceId/" component={InvoiceDetails} />
      </Route>

      <Route path="instance-level-oauth">
        <IndexRoute component={InstanceLevelOAuth} />
        <Route path=":clientID/" component={InstanceLevelOAuthDetails} />
      </Route>

      <Route path="billing-plans/">
        <IndexRoute component={BillingPlans} />
      </Route>

      <Route path="spike-projection-generation/">
        <IndexRoute component={GenerateSpikeProjectionsForBatch} />
      </Route>
      <Route path="*" component={NotFound} />
    </Route>
  );
}

export const routes6 = buildReactRouter6Routes(buildRoutes());
