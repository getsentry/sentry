import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUpdateGroupSearchViewStarredOrder} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarredOrder';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {IssueViewItem} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViewItem';
import {useStarredIssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/useStarredIssueViews';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

function IssueViewsImpl() {
  const organization = useOrganization();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const {starredViews: views, setStarredIssueViews: setViews} = useStarredIssueViews();

  const {mutate: updateStarredViewsOrder} = useUpdateGroupSearchViewStarredOrder();

  useLLMContext({
    contextHint:
      'The starred issue views listed in the Issues secondary nav panel. Each ' +
      "view's live issue count is a further-nested child node (nodeType " +
      '"navigation"), keyed by the same view id.',
    views: views.map(view => ({
      id: view.id,
      label: view.label,
      query: view.query,
      querySort: view.querySort,
      projects: view.projects,
      environments: view.environments,
      isActive: view.id === viewId,
    })),
  });

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
            setViews(newViews);
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

export const IssueViews = registerLLMContext('navigation', IssueViewsImpl);
