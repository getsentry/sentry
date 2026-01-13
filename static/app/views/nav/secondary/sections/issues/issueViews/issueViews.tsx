import {useCallback, useMemo, useState} from 'react';
import {Reorder} from 'framer-motion';
import debounce from 'lodash/debounce';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {IssueViewParams} from 'sentry/views/issueList/issueViews/utils';
import {useUpdateGroupSearchViewStarredOrder} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarredOrder';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {IssueViewItem} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewItem';
import {useStarredIssueViews} from 'sentry/views/nav/secondary/sections/issues/issueViews/useStarredIssueViews';

interface IssueViewsProps {
  sectionRef: React.RefObject<HTMLDivElement | null>;
}

export interface IssueView extends IssueViewParams {
  createdBy: AvatarUser | null;
  dateCreated: string;
  dateUpdated: string;
  id: string;
  label: string;
  lastVisited: string | null;
  stars: number;
}

export function IssueViews({sectionRef}: IssueViewsProps) {
  const organization = useOrganization();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const {starredViews: views, setStarredIssueViews: setViews} = useStarredIssueViews();

  const [isDragging, setIsDragging] = useState<string | null>(null);

  const {mutate: updateStarredViewsOrder} = useUpdateGroupSearchViewStarredOrder();

  const debounceUpdateStarredViewsOrder = useMemo(
    () =>
      debounce((newViews: IssueView[]) => {
        updateStarredViewsOrder({
          orgSlug: organization.slug,
          viewIds: newViews.map(view => parseInt(view.id, 10)),
        });
      }, 500),
    [organization.slug, updateStarredViewsOrder]
  );

  const handleReorderComplete = useCallback(() => {
    debounceUpdateStarredViewsOrder(views);

    trackAnalytics('issue_views.reordered_views', {
      leftNav: true,
      organization: organization.slug,
    });
  }, [debounceUpdateStarredViewsOrder, organization.slug, views]);

  if (!views.length) {
    return null;
  }

  return (
    <SecondaryNav.Section id="issues-starred-views" title={t('Starred Views')}>
      <Reorder.Group
        as="div"
        axis="y"
        values={views}
        onReorder={newOrder => setViews(newOrder)}
        initial={false}
        ref={sectionRef}
      >
        {views.map(view => (
          <IssueViewItem
            key={view.id}
            view={view}
            sectionRef={sectionRef}
            isActive={view.id === viewId}
            onReorderComplete={handleReorderComplete}
            isLastView={views.length === 1}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        ))}
      </Reorder.Group>
    </SecondaryNav.Section>
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
