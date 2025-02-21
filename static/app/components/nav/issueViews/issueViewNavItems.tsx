import {useCallback, useEffect, useMemo, useState} from 'react';
import {AnimatePresence, Reorder} from 'framer-motion';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {IssueViewNavItemContent} from 'sentry/components/nav/issueViews/issueViewNavItemContent';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {IssueViewPF} from 'sentry/views/issueList/issueViewsPF/issueViewsPF';
import {generateTempViewId} from 'sentry/views/issueList/issueViewsPF/issueViewsPF';
import {useUpdateGroupSearchViews} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

interface IssueViewNavItemsProps {
  baseUrl: string;
  loadedViews: IssueViewPF[];
  sectionRef: React.RefObject<HTMLDivElement>;
}

export function IssueViewNavItems({
  loadedViews,
  sectionRef,
  baseUrl,
}: IssueViewNavItemsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const queryParams = location.query;

  const [views, setViews] = useState<IssueViewPF[]>(loadedViews);

  // If the `viewId` (from `/issues/views/:viewId`) is not found in the views array,
  // then redirect to the "All Issues" page
  useEffect(() => {
    if (viewId && !views.find(v => v.id === viewId)) {
      navigate(
        normalizeUrl({
          pathname: `${baseUrl}/`,
          query: queryParams,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  const replaceWithPersistentViewIds = useCallback(
    (responseViews: GroupSearchView[]) => {
      const newlyCreatedViews = responseViews.filter(
        view => !views.find(tab => tab.id === view.id)
      );
      if (newlyCreatedViews.length > 0) {
        const assignedIds = new Set();

        const currentView = views.find(tab => tab.id === viewId);
        const updatedViews = views.map(tab => {
          if (tab.id && tab.id[0] === '_') {
            const matchingView = newlyCreatedViews.find(
              view =>
                view.id &&
                !assignedIds.has(view.id) &&
                tab.query === view.query &&
                tab.querySort === view.querySort &&
                tab.label === view.name
            );
            if (matchingView?.id) {
              assignedIds.add(matchingView.id);
              return {...tab, id: matchingView.id, key: matchingView.id};
            }
          }
          return tab;
        });
        setViews(updatedViews);

        if (viewId?.startsWith('_') && currentView) {
          const matchingView = newlyCreatedViews.find(
            view =>
              view.id &&
              currentView.query === view.query &&
              currentView.querySort === view.querySort
          );
          if (matchingView?.id) {
            navigate(
              normalizeUrl({
                pathname: `${baseUrl}/views/${matchingView.id}/`,
                query: queryParams,
              }),
              {replace: true}
            );
          }
        }
      }
      return;
    },
    [baseUrl, navigate, queryParams, viewId, views]
  );

  const {mutate: updateViews} = useUpdateGroupSearchViews({
    onSuccess: replaceWithPersistentViewIds,
  });

  const debounceUpdateViews = useMemo(
    () =>
      debounce((newTabs: IssueViewPF[]) => {
        if (newTabs) {
          updateViews({
            orgSlug: organization.slug,
            groupSearchViews: newTabs
              .filter(tab => tab.isCommitted)
              .map(tab => ({
                // Do not send over an ID if it's a temporary or default tab so that
                // the backend will save these and generate permanent Ids for them
                ...(tab.id[0] !== '_' && !tab.id.startsWith('default')
                  ? {id: tab.id}
                  : {}),
                name: tab.label,
                query: tab.query,
                querySort: tab.querySort,
                projects: isEqual(tab.projects, [-1]) ? [] : tab.projects,
                isAllProjects: isEqual(tab.projects, [-1]),
                environments: tab.environments,
                timeFilters: tab.timeFilters,
              })),
          });
        }
      }, 500),
    [organization.slug, updateViews]
  );

  const handleReorder = useCallback(
    (newOrder: IssueViewPF[]) => {
      setViews(newOrder);
      debounceUpdateViews(newOrder);
    },
    [debounceUpdateViews]
  );

  const handleUpdateView = useCallback(
    (view: IssueViewPF, updatedView: IssueViewPF) => {
      const newViews = views.map(v => {
        if (v.id === view.id) {
          return updatedView;
        }
        return v;
      });
      debounceUpdateViews(newViews);
      setViews(newViews);
    },
    [debounceUpdateViews, views]
  );

  const handleDeleteView = useCallback(
    (view: IssueViewPF) => {
      const newViews = views.filter(v => v.id !== view.id);
      setViews(newViews);
      debounceUpdateViews(newViews);
      // Only redirect if the deleted view is the active view
      if (view.id === viewId) {
        const newUrl =
          newViews.length > 0 ? constructViewLink(baseUrl, newViews[0]!) : `${baseUrl}/`;
        navigate(newUrl);
      }
    },
    [views, debounceUpdateViews, viewId, baseUrl, navigate]
  );

  const handleDuplicateView = useCallback(
    (view: IssueViewPF) => {
      const idx = views.findIndex(v => v.id === view.id);
      if (idx !== -1) {
        const newViewId = generateTempViewId();
        const duplicatedView = {
          ...views[idx]!,
          id: newViewId,
          label: `${views[idx]!.label} (Copy)`,
        };
        const newViews = [
          ...views.slice(0, idx + 1),
          duplicatedView,
          ...views.slice(idx + 1),
        ];
        setViews(newViews);
        debounceUpdateViews(newViews);
        if (view.id === viewId) {
          navigate(constructViewLink(baseUrl, duplicatedView));
        }
      }
    },
    [views, viewId, baseUrl, navigate, debounceUpdateViews]
  );

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={views ?? []}
      onReorder={handleReorder}
      initial={false}
      ref={sectionRef}
    >
      {views.map(view => (
        <AnimatePresence key={view.id}>
          <IssueViewNavItemContent
            view={view}
            sectionRef={sectionRef}
            isActive={view.id === viewId}
            updateView={updatedView => handleUpdateView(view, updatedView)}
            deleteView={() => handleDeleteView(view)}
            duplicateView={() => handleDuplicateView(view)}
          />
        </AnimatePresence>
      ))}
    </Reorder.Group>
  );
}

export const constructViewLink = (baseUrl: string, view: IssueViewPF) => {
  return normalizeUrl({
    pathname: `${baseUrl}/views/${view.id}/`,
    query: {
      query: view.unsavedChanges?.query ?? view.query,
      sort: view.unsavedChanges?.querySort ?? view.querySort,
      project: view.unsavedChanges?.projects ?? view.projects,
      environment: view.unsavedChanges?.environments ?? view.environments,
      ...normalizeDateTimeParams(view.unsavedChanges?.timeFilters ?? view.timeFilters),
      cursor: undefined,
      page: undefined,
    },
  });
};
