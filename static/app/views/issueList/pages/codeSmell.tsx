import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Redirect from 'sentry/components/redirect';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

type Props = RouteComponentProps;

const TITLE = t('Code Smell');
const QUERY =
  'is:unresolved issue.category:[user_experience,responsiveness,performance_best_practice]';

export default function ErrorsOutagesPage(props: Props) {
  const organization = useOrganization();
  const hasIssueTaxonomy = organization.features.includes('issue-taxonomy');
  if (!hasIssueTaxonomy) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <SentryDocumentTitle title={TITLE} orgSlug={organization.slug}>
      <IssueListContainer>
        <PageFiltersContainer>
          <NoProjectMessage organization={organization}>
            <IssueListOverview {...props} initialQuery={QUERY} title={TITLE} />
          </NoProjectMessage>
        </PageFiltersContainer>
      </IssueListContainer>
    </SentryDocumentTitle>
  );
}
