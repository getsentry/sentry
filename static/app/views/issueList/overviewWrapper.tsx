import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';
import IssueListOverviewFc from 'sentry/views/issueList/overviewFc';

type OverviewWrapperProps = RouteComponentProps<{}, {searchId?: string}>;

// This is a temporary wrapper to allow us to migrate to the refactored issue stream component.
// Remove once feature flag is retired.
export function OverviewWrapper(props: OverviewWrapperProps) {
  const organization = useOrganization();

  if (organization.features.includes('issue-stream-functional-refactor')) {
    return (
      <IssueListContainer>
        <IssueListOverviewFc {...props} />
      </IssueListContainer>
    );
  }

  return (
    <IssueListContainer>
      <IssueListOverview {...props} />
    </IssueListContainer>
  );
}
