import type {Location} from 'history';

import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import PageLayout from '../pageLayout';
import Tab from '../tabs';

import SpansContent from './content';
import {generateSpansEventView} from './utils';

type Props = {
  location: Location;
};

export default function TransactionSpans({location}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
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
