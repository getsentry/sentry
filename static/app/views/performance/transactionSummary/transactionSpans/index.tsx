import {Location} from 'history';
import pick from 'lodash/pick';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import PageLayout from '../pageLayout';
import Tab from '../tabs';

import SpansContent from './content';
import {generateSpansEventView} from './utils';

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
      generateEventView={generateSpansEventView}
      childComponent={SpansContent}
      relativeDateOptions={RELATIVE_PERIODS}
      maxPickableDays={30}
    />
  );
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
