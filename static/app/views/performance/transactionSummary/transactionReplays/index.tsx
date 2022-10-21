import {Fragment, useEffect} from 'react';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import type {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

import {decodeFilterFromLocation, SpanOperationBreakdownFilter} from '../filter';
import PageLayout, {ChildProps} from '../pageLayout';
import Tab from '../tabs';
import {decodeEventsDisplayFilterFromLocation} from '../transactionEvents/utils';

import ReplaysContent from './content';
import useReplaysFromTransaction from './useReplaysFromTransaction';

type Props = {
  location: Location<ReplayListLocationQuery>;
  organization: Organization;
  projects: Project[];
};

function renderNoAccess() {
  return (
    <PageContent>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </PageContent>
  );
}

function TransactionReplays(props: Props) {
  const {location, organization, projects} = props;

  return (
    <Feature
      features={['session-replay-ui']}
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <PageLayout
        location={location}
        organization={organization}
        projects={projects}
        tab={Tab.Replays}
        getDocumentTitle={getDocumentTitle}
        generateEventView={generateEventView}
        childComponent={ReplaysContentWrapper}
      />
    </Feature>
  );
}

function ReplaysContentWrapper({
  eventView: eventsWithReplaysView,
  location,
  organization,
  setError,
}: ChildProps) {
  const eventsDisplayFilterName = decodeEventsDisplayFilterFromLocation(location);
  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);

  const {eventView, replays, pageLinks, isFetching, fetchError} =
    useReplaysFromTransaction({
      eventsWithReplaysView,
      location,
      organization,
      eventsDisplayFilterName,
      spanOperationBreakdownFilter,
    });

  useEffect(() => {
    setError(fetchError?.message);
  }, [setError, fetchError]);

  if (isFetching || !eventView) {
    return (
      <Layout.Main fullWidth>
        <LoadingIndicator />
      </Layout.Main>
    );
  }

  return replays ? (
    <ReplaysContent
      eventView={eventView}
      isFetching={isFetching}
      location={location}
      organization={organization}
      pageLinks={pageLinks}
      replays={replays}
      eventsDisplayFilterName={eventsDisplayFilterName}
      spanOperationBreakdownFilter={spanOperationBreakdownFilter}
    />
  ) : (
    <Fragment>{null}</Fragment>
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Replays')].join(' \u2014 ');
  }

  return [t('Summary'), t('Replays')].join(' \u2014 ');
}

function generateEventView({
  location,
  transactionName,
}: {
  location: Location;
  transactionName: string;
}) {
  const fields = ['replayId', 'count()', 'transaction.duration', 'trace', 'timestamp'];

  const breakdown = decodeFilterFromLocation(location);
  if (breakdown !== SpanOperationBreakdownFilter.None) {
    fields.push(`spans.${breakdown}`);
  } else {
    fields.push(...SPAN_OP_BREAKDOWN_FIELDS, SPAN_OP_RELATIVE_BREAKDOWN_FIELD);
  }

  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions.setFilterValues('event.type', ['transaction']);
  conditions.addFilterValues('transaction', [transactionName]);
  conditions.addFilterValues('!replayId', ['']);

  return EventView.fromNewQueryWithLocation(
    {
      id: '',
      name: `Replay events within a transaction`,
      version: 2,
      fields,
      query: conditions.formatString(),
      projects: [],
      orderby: decodeScalar(location.query.sort, '-timestamp'),
    },
    location
  );
}

export default withProjects(withOrganization(TransactionReplays));
