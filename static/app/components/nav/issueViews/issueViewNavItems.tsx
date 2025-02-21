import {useEffect} from 'react';
import {AnimatePresence, Reorder} from 'framer-motion';

import {IssueViewNavItemContent} from 'sentry/components/nav/issueViews/issueViewNavItemContent';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {generateTempViewId} from 'sentry/views/issueList/issueViews/issueViews';
import type {IssueViewPF} from 'sentry/views/issueList/issueViewsPF/issueViewsPF';

interface IssueViewNavItemsProps {
  baseUrl: string;
  sectionRef: React.RefObject<HTMLDivElement>;
  setViews: (views: IssueViewPF[]) => void;
  views: IssueViewPF[];
}

export function IssueViewNavItems({
  views,
  setViews,
  sectionRef,
  baseUrl,
}: IssueViewNavItemsProps) {
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = location.query;

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

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={views ?? []}
      onReorder={setViews}
      initial={false}
      ref={sectionRef}
    >
      {views.map(view => (
        <AnimatePresence key={view.id}>
          <IssueViewNavItemContent
            view={view}
            sectionRef={sectionRef}
            isActive={view.id === viewId}
            updateView={updatedView => {
              const newViews = views.map(v => {
                if (v.id === view.id) {
                  return updatedView;
                }
                return v;
              });
              setViews(newViews);
            }}
            deleteView={() => {
              const newViews = views.filter(v => v.id !== view.id);
              setViews(newViews);
              // Only redirect if the deleted view is the active view
              if (view.id === viewId) {
                const newUrl =
                  newViews.length > 0
                    ? constructViewLink(baseUrl, newViews[0]!)
                    : `${baseUrl}/`;
                navigate(newUrl);
              }
            }}
            duplicateView={() => {
              const newViewId = generateTempViewId();
              const idx = views.findIndex(v => v.id === view.id);
              if (idx !== -1) {
                const duplicatedView = {
                  ...views[idx]!,
                  id: newViewId,
                  label: `${views[idx]!.label} (Copy)`,
                };
                setViews([
                  ...views.slice(0, idx + 1),
                  duplicatedView,
                  ...views.slice(idx + 1),
                ]);
              }
            }}
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
