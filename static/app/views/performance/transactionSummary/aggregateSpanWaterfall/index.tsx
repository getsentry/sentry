import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {AggregateSpans} from 'sentry/components/events/interfaces/spans/aggregateSpans';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import Tab from 'sentry/views/performance/transactionSummary/tabs';

import PageLayout from '../pageLayout';

function renderNoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

function AggregateSpanWaterfall(): React.ReactElement {
  const location = useLocation();
  const organization = useOrganization();
  const projects = useProjects();

  const transaction = decodeScalar(location.query.transaction);
  const httpMethod = decodeScalar(location.query['http.method']);
  return (
    <Feature
      features={['starfish-aggregate-span-waterfall']}
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <PageLayout
        location={location}
        organization={organization}
        projects={projects.projects}
        tab={Tab.AGGREGATE_WATERFALL}
        generateEventView={() => EventView.fromLocation(location)}
        getDocumentTitle={() => t(`Aggregate Waterfall: %s`, transaction)}
        childComponent={() => {
          return (
            <Layout.Main fullWidth>
              {defined(transaction) && (
                <AggregateSpans transaction={transaction} httpMethod={httpMethod} />
              )}
            </Layout.Main>
          );
        }}
      />
    </Feature>
  );
}

export default AggregateSpanWaterfall;
