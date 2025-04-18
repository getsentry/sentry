import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

type Props = RouteComponentProps;

export default function NewViewPage(props: Props) {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('New View')} orgSlug={organization.slug}>
      <IssueListContainer>
        <PageFiltersContainer skipLoadLastUsed disablePersistence skipInitializeUrlParams>
          <NoProjectMessage organization={organization}>
            <IssueListOverview {...props} />
          </NoProjectMessage>
        </PageFiltersContainer>
      </IssueListContainer>
    </SentryDocumentTitle>
  );
}
