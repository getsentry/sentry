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
import type {IssueViewParams} from 'sentry/views/issueList/issueViews/issueViews';
import {isNewViewPage} from 'sentry/views/issueList/issueViews/utils';
import {useUpdateGroupSearchViewStarredOrder} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarredOrder';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {IssueViewAddViewButton} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewAddViewButton';
import {IssueViewNavItemContent} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavItemContent';
import {useStarredIssueViews} from 'sentry/views/nav/secondary/sections/issues/issueViews/useStarredIssueViews';

interface IssueViewNavItemsProps {
  baseUrl: string;
  sectionRef: React.RefObject<HTMLDivElement | null>;
}

export interface NavIssueView extends IssueViewParams {
  createdBy: AvatarUser;
  id: string;
  label: string;
  lastVisited: string | null;
  stars: number;
}

export function IssueViewNavItems({sectionRef, baseUrl}: IssueViewNavItemsProps) {
  const organization = useOrganization();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const {starredViews: views, setStarredIssueViews: setViews} = useStarredIssueViews();

  const [isDragging, setIsDragging] = useState<string | null>(null);

  const {mutate: updateStarredViewsOrder} = useUpdateGroupSearchViewStarredOrder();

  const debounceUpdateStarredViewsOrder = useMemo(
    () =>
      debounce((newViews: NavIssueView[]) => {
        updateStarredViewsOrder({
          orgSlug: organization.slug,
          viewIds: newViews
            .filter(view => view.id[0] !== '_' && !view.id.startsWith('default'))
            .map(view => parseInt(view.id, 10)),
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

  return (
    <SecondaryNav.Section
      title={t('Starred Views')}
      trailingItems={<IssueViewAddViewButton />}
    >
      <Reorder.Group
        as="div"
        axis="y"
        values={views}
        onReorder={newOrder => setViews(newOrder)}
        initial={false}
        ref={sectionRef}
      >
        {views.map(view => (
          <IssueViewNavItemContent
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
      {organization.features.includes('issue-view-sharing') && (
        <SecondaryNav.Item to={`${baseUrl}/views/`} end>
          {t('All Views')}
        </SecondaryNav.Item>
      )}
      {isNewViewPage(location.pathname) ? (
        <SecondaryNav.Item to={`${baseUrl}/views/new/`} isActive>
          {t('New View')}
        </SecondaryNav.Item>
      ) : null}
    </SecondaryNav.Section>
  );
}

export const constructViewLink = (baseUrl: string, view: NavIssueView) => {
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
