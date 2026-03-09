import Feature from 'sentry/components/acl/feature';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/pageFilters/container';
import {t} from 'sentry/locale';
import {IssueCategory} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

const QUERY = `is:unresolved issue.category:${IssueCategory.CONFIGURATION}`;

export default function ConfigurationIssuesPage() {
  const organization = useOrganization();

  return (
    <Feature features="issue-sourcemap-configuration-visible" renderDisabled>
      <IssueListContainer title={t('Configuration Issues')}>
        <PageFiltersContainer>
          <NoProjectMessage organization={organization}>
            <IssueListOverview
              initialQuery={QUERY}
              title={t('Configuration Issues')}
              titleDescription={t(
                'Issues detected from SDK or tooling configuration problems, such as missing or broken source maps'
              )}
            />
          </NoProjectMessage>
        </PageFiltersContainer>
      </IssueListContainer>
    </Feature>
  );
}
