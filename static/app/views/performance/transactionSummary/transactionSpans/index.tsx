import {Location} from 'history';
import pick from 'lodash/pick';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import PageLayout from '../pageLayout';
import Tab from '../tabs';

import SpansContent from './content';
import {SpanSortOthers, SpanSortPercentiles} from './types';
import {getSuspectSpanSortFromLocation} from './utils';

const RELATIVE_PERIODS = pick(DEFAULT_RELATIVE_PERIODS, [
  '1h',
  '24h',
  '7d',
  '14d',
  '30d',
]);

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionSpans(props: Props) {
  const {location, organization, projects} = props;

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.Spans}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
      childComponent={SpansContent}
      relativeDateOptions={RELATIVE_PERIODS}
      maxPickableDays={30}
    />
  );
}

function generateEventView(location: Location, transactionName: string): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: [...Object.values(SpanSortOthers), ...Object.values(SpanSortPercentiles)],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );

  const sort = getSuspectSpanSortFromLocation(location);
  return eventView.withSorts([{field: sort.field, kind: 'desc'}]);
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Performance')].join(' - ');
  }

  return [t('Summary'), t('Performance')].join(' - ');
}

export default withProjects(withOrganization(TransactionSpans));
