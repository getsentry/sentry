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
import {isAggregateField} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayList, {
  DEFAULT_SORT,
  REPLAY_LIST_FIELDS,
} from 'sentry/utils/replays/hooks/useReplayList';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

import PageLayout, {ChildProps} from '../pageLayout';
import Tab from '../tabs';

import ReplaysContent from './content';

type Props = {
  location: Location<ReplayListLocationQuery>;
  organization: Organization;
  projects: Project[];
};

function TransactionReplays(props: Props) {
  const {location, organization, projects} = props;

  function renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

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
  eventView,
  location,
  organization,
  setError,
}: ChildProps) {
  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    organization,
    eventView,
  });

  useEffect(() => {
    setError(fetchError?.message);
  }, [setError, fetchError]);

  if (isFetching) {
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
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  return EventView.fromNewQueryWithLocation(
    {
      id: '',
      name: transactionName,
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [],
      query: conditions.formatString(),
      orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
    },
    location
  );
}

export default withProjects(withOrganization(TransactionReplays));
