import {
  createContext,
  Fragment,
  useContext,
  useReducer,
  useState,
  useId,
  type ReactNode,
  useRef,
} from 'react';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Grid} from '@sentry/scraps/layout';

import {openConfirmModal} from 'sentry/components/confirm';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {unreachable} from 'sentry/utils/unreachable';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {DEFAULT_PREBUILT_SORT} from 'sentry/views/dashboards/manage/settings';
import {DashboardFilter, PREBUILT_DASHBOARD_LABEL} from 'sentry/views/dashboards/types';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {isPrimaryNavigationLinkActive} from 'sentry/views/navigation/primary/components';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {DashboardsNavigationItems} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsNavigationItems';

export function DashboardsSecondaryNavigation() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;
  const {projects} = useProjects();
  const user = useUser();

  const location = useLocation();
  const {data: starredDashboards = []} = useGetStarredDashboards();
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );
  const urlFilter = decodeScalar(location.query.filter) as DashboardFilter | undefined;
  const isOnlyPrebuilt = urlFilter === DashboardFilter.ONLY_PREBUILT;
  const isOnDashboardsList = isPrimaryNavigationLinkActive(
    `${baseUrl}/`,
    location.pathname,
    {
      end: true,
    }
  );

  const [dynamicTitle, setDynamicTitle] = useState<string>(
    'Custom Dashboard Section Title'
  );

  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Dashboards')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="dashboards-all">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/`}
                end
                isActive={
                  hasPrebuiltDashboards
                    ? isOnDashboardsList && !isOnlyPrebuilt
                    : undefined
                }
                analyticsItemName="dashboards_all"
              >
                {t('All Dashboards')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            {hasPrebuiltDashboards ? (
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/?filter=${DashboardFilter.ONLY_PREBUILT}&sort=${DEFAULT_PREBUILT_SORT}`}
                  isActive={isOnDashboardsList && isOnlyPrebuilt}
                  analyticsItemName="dashboards_sentry_built"
                >
                  {PREBUILT_DASHBOARD_LABEL}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            ) : null}
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        {starredDashboards.length > 0 ? (
          <Fragment>
            <SecondaryNavigation.Separator />
            <DashboardSectionProvider dashboard={{title: dynamicTitle}}>
              <DashboardReorderableSection>
                <DashboardsNavigationItems initialDashboards={starredDashboards} />
              </DashboardReorderableSection>
            </DashboardSectionProvider>
            <SecondaryNavigation.Section
              id="dashboards-starred"
              title={t('Starred Dashboards')}
            >
              <ErrorBoundary mini>
                <StarredDashboardItems
                  dashboards={starredDashboards}
                  projects={projects}
                  organizationSlug={organization.slug}
                  organizationId={organization.id}
                  userId={user.id}
                />
              </ErrorBoundary>
            </SecondaryNavigation.Section>
          </Fragment>
        ) : null}
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

function StarredDashboardItems({
  dashboards,
  projects,
  organizationSlug,
  organizationId,
  userId,
}: {
  dashboards: DashboardListItem[];
  organizationId: string;
  organizationSlug: string;
  projects: Project[];
  userId: string;
}) {
  return (
    <SecondaryNavigation.List>
      {dashboards.map(dashboard => {
        const dashboardProjects = new Set((dashboard?.projects ?? []).map(String));
        if (!defined(dashboard?.projects)) {
          Sentry.setTag('organization', organizationId);
          Sentry.setTag('dashboard.id', dashboard.id);
          Sentry.setTag('user.id', userId);
          Sentry.captureMessage('dashboard.projects is undefined in starred sidebar', {
            level: 'warning',
          });
        }
        const dashboardProjectPlatforms = projects
          .filter(p => dashboardProjects.has(p.id))
          .map(p => p.platform)
          .filter(defined);

        return (
          <SecondaryNavigation.ListItem key={dashboard.id}>
            <SecondaryNavigation.Link
              to={`/organizations/${organizationSlug}/dashboard/${dashboard.id}/`}
              analyticsItemName="dashboard_starred_item"
              leadingItems={
                <SecondaryNavigation.ProjectIcon
                  projectPlatforms={dashboardProjectPlatforms}
                  allProjects={
                    dashboard.projects?.length === 1 && dashboard.projects[0] === -1
                  }
                />
              }
            >
              {dashboard.title}
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
        );
      })}
    </SecondaryNavigation.List>
  );
}

function StarredDashboardSectionOverflowMenu() {
  const [_, dispatch] = useDashboardContext();

  return (
    <SecondaryNavigation.OverflowMenu
      items={[
        {
          label: t('Rename section'),
          key: 'rename-section',
          onAction: () => {
            dispatch({type: 'set state', state: 'renaming'});
          },
        },
        {
          label: t('Delete section'),
          key: 'delete-section',
          onAction: () => {
            dispatch({type: 'set state', state: 'deleting'});
            openConfirmModal({
              message: t('Delete section'),
              confirmText: t('Delete'),
              cancelText: t('Cancel'),
              onConfirm: () => {
                dispatch({type: 'set state', state: 'initial'});
              },
            });
          },
        },
      ]}
    />
  );
}

function DashboardReorderableSection({children}: {children: ReactNode}) {
  const id = useId();
  const [{state, title}, dispatch] = useDashboardContext();

  return (
    <SecondaryNavigation.ReorderableSection
      id={id}
      collapsible={state !== 'renaming'}
      trailingItems={
        state === 'renaming' ? null : <StarredDashboardSectionOverflowMenu />
      }
      title={
        state === 'renaming' ? (
          <Grid columns="1fr auto" align="center" width="100%" height="100%" gap="sm">
            {p => (
              <form
                {...p}
                onSubmit={e => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  const newTitle = formData.get('title');

                  if (typeof newTitle !== 'string') {
                    return;
                  }

                  dispatch({
                    type: 'rename dashboard',
                    title: newTitle,
                  });
                }}
              >
                <Input size="xs" required autoFocus name="title" defaultValue={title} />
                <Button
                  size="xs"
                  type="submit"
                  aria-label={t('Save')}
                  icon={<IconCheckmark aria-hidden="true" />}
                />
              </form>
            )}
          </Grid>
        ) : (
          title
        )
      }
    >
      {children}
    </SecondaryNavigation.ReorderableSection>
  );
}

interface DashboardSectionReducerState {
  state: 'initial' | 'renaming' | 'deleting';
  title: string;
}

type DashboardSectionStateAction =
  | {
      state: DashboardSectionReducerState['state'];
      type: 'set state';
    }
  | {
      title: DashboardSectionReducerState['title'];
      type: 'rename dashboard';
    };

function dashboardStateReducer(
  state: DashboardSectionReducerState,
  action: DashboardSectionStateAction
): DashboardSectionReducerState {
  switch (action.type) {
    case 'set state':
      return {...state, state: action.state, title: state.title};
    case 'rename dashboard':
      if (!action.title) {
        return {...state, state: 'initial'};
      }
      return {...state, title: action.title, state: 'initial'};
    default:
      return state;
  }
}

interface DashboardSectionProviderProps {
  children: ReactNode;
  dashboard: {
    title: string;
  };
}

const DashboardContext = createContext<
  [DashboardSectionReducerState, React.Dispatch<DashboardSectionStateAction>] | null
>(null);

function DashboardSectionProvider({children, dashboard}: DashboardSectionProviderProps) {
  const [state, dispatch] = useReducer(dashboardStateReducer, {
    state: 'initial',
    title: dashboard.title,
  });

  return (
    <DashboardContext.Provider value={[state, dispatch]}>
      {children}
    </DashboardContext.Provider>
  );
}

function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardContext');
  }
  return context;
}
