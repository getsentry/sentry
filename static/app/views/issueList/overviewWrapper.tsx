import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {defined} from 'sentry/utils';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

type OverviewWrapperProps = RouteComponentProps<
  Record<PropertyKey, string | undefined>,
  {searchId?: string}
>;

export function OverviewWrapper(props: OverviewWrapperProps) {
  const shouldFetchOnMount = !defined(props.location.query.new);
  const prefersStackedNav = usePrefersStackedNav();

  const title = prefersStackedNav ? t('Feed') : t('Issues');

  return (
    <IssueListContainer title={title}>
      <IssueListOverview
        {...props}
        shouldFetchOnMount={shouldFetchOnMount}
        title={title}
      />
    </IssueListContainer>
  );
}
