import {Location} from 'history';

import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import PageLayout from '../pageLayout';
import Tab from '../tabs';

import SpansContent from './content';
import {generateSpansEventView} from './utils';

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
      tab={Tab.SPANS}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateSpansEventView}
      childComponent={SpansContent}
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
