import {Fragment} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {IssueViewParams} from 'sentry/views/issueList/issueViews/utils';
import {useUpdateGroupSearchViewStarredOrder} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarredOrder';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {IssueViewItem} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViewItem';
import {useStarredIssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/useStarredIssueViews';

export interface IssueView extends IssueViewParams {
  createdBy: AvatarUser | null;
  dateCreated: string;
  dateUpdated: string;
  id: string;
  label: string;
  lastVisited: string | null;
  stars: number;
}

export function IssueViews() {
  const organization = useOrganization();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const {starredViews: views} = useStarredIssueViews();

  const {mutate: updateStarredViewsOrder} = useUpdateGroupSearchViewStarredOrder();

  if (!views.length) {
    return null;
  }

  return (
    <Fragment>
      <SecondaryNavigation.Separator />
      <SecondaryNavigation.Section id="issues-starred-views" title={t('Starred Views')}>
        <SecondaryNavigation.ReorderableList
          items={views}
          onDragEnd={newViews => {
            updateStarredViewsOrder({
              orgSlug: organization.slug,
              viewIds: newViews.map(view => parseInt(view.id, 10)),
            });
            trackAnalytics('issue_views.reordered_views', {
              leftNav: true,
              organization: organization.slug,
            });
          }}
        >
          {view => (
            <IssueViewItem key={view.id} view={view} isActive={view.id === viewId} />
          )}
        </SecondaryNavigation.ReorderableList>
      </SecondaryNavigation.Section>
    </Fragment>
  );
}

export const constructViewLink = (baseUrl: string, view: IssueView) => {
  return normalizeUrl({
    pathname: `${baseUrl}/views/${view.id}/`,
    query: {
      query: view.query,
      sort: view.querySort,
      project: view.projects,
      environment: view.environments,
      ...normalizeDateTimeParams(view.timeFilters),
      cursor: undefined,
      page: undefined,
    },
  });
};
