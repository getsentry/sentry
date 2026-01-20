import Feature from 'sentry/components/acl/feature';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {t} from 'sentry/locale';
import {IssueCategory} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

const QUERY = `is:unresolved issue.category:${IssueCategory.INSTRUMENTATION}`;

export default function InstrumentationPage() {
  const organization = useOrganization();

  return (
    <Feature features="seer-autopilot" renderDisabled>
      <IssueListContainer title={t('Instrumentation')}>
        <PageFiltersContainer>
          <NoProjectMessage organization={organization}>
            <IssueListOverview
              initialQuery={QUERY}
              title={t('Instrumentation')}
              titleDescription={t(
                'Issues suggesting improvements to your instrumentation and SDK usage'
              )}
            />
          </NoProjectMessage>
        </PageFiltersContainer>
      </IssueListContainer>
    </Feature>
  );
}
