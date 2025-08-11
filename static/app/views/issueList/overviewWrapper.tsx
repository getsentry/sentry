import {TAXONOMY_DEFAULT_QUERY} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

import {DEFAULT_QUERY} from './utils';

type OverviewWrapperProps = RouteComponentProps<
  Record<PropertyKey, string | undefined>,
  {searchId?: string}
>;

export function OverviewWrapper(props: OverviewWrapperProps) {
  const shouldFetchOnMount = !defined(props.location.query.new);
  const prefersStackedNav = usePrefersStackedNav();
  const organization = useOrganization();

  const title = prefersStackedNav ? t('Feed') : t('Issues');

  const defaultQuery = organization.features.includes('issue-taxonomy')
    ? TAXONOMY_DEFAULT_QUERY
    : DEFAULT_QUERY;

  return (
    <IssueListContainer title={title}>
      <IssueListOverview
        {...props}
        shouldFetchOnMount={shouldFetchOnMount}
        title={title}
        initialQuery={defaultQuery}
      />
    </IssueListContainer>
  );
}
