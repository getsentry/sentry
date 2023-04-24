import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
import EventList from 'sentry/views/starfish/views/webServiceView/endpointFailureEvents/eventList';
import IssueList from 'sentry/views/starfish/views/webServiceView/endpointFailureEvents/issueList';

type Props = {
  location: Location;
} & RouteComponentProps<{slug: string}, {}>;

export default function EndpointFailureEvents({params, location}: Props) {
  const slug = parseSlug(params.slug);
  const organization = useOrganization();
  if (!slug) {
    return <div>ERROR</div>;
  }

  const {httpOp, transactionName} = slug || {};
  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {httpOp} {transactionName}
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <IssueList
              location={location}
              organization={organization}
              transactionName={transactionName}
            />
            <EventList
              httpOp={httpOp}
              location={location}
              organization={organization}
              transactionName={transactionName}
            />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

type HttpOpAndEndpoint = {
  httpOp: string;
  transactionName: string;
};

function parseSlug(slug?: string): HttpOpAndEndpoint | undefined {
  if (!slug) {
    return undefined;
  }

  const delimiterPosition = slug.lastIndexOf(':');
  if (delimiterPosition < 0) {
    return undefined;
  }

  const httpOp = slug.slice(0, delimiterPosition);
  const transactionName = slug.slice(delimiterPosition + 1);

  return {httpOp, transactionName};
}
