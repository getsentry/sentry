import ErrorBoundary from 'sentry/components/errorBoundary';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';

export function DetectorDetailsOngoingIssues() {
  return (
    <Section title={t('Ongoing Issues')}>
      {/* TODO: Implement fetching and replace with GroupList */}
      <ErrorBoundary mini>
        <SimpleTable>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
          </SimpleTable.Header>
          <SimpleTable.Empty>{t('Not yet implemented')}</SimpleTable.Empty>
        </SimpleTable>
      </ErrorBoundary>
    </Section>
  );
}
