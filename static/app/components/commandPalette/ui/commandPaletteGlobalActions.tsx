import {useMemo} from 'react';
import {SentryGlobalSearch} from '@sentry-internal/global-search';
import {useMutation} from '@tanstack/react-query';
import DOMPurify from 'dompurify';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {cmdkQueryOptions} from 'sentry/components/commandPalette/types';
import type {
  CMDKQueryOptions,
  CommandPaletteAction,
} from 'sentry/components/commandPalette/types';
import {
  DSN_PATTERN,
  getDsnNavTargets,
} from 'sentry/components/search/sources/dsnLookupUtils';
import type {DsnLookupResponse} from 'sentry/components/search/sources/dsnLookupUtils';
import {limitedMetricsSupportPrefixes} from 'sentry/data/platformCategories';
import {
  IconAdd,
  IconAllProjects,
  IconCompass,
  IconDashboard,
  IconDiscord,
  IconDocs,
  IconFlag,
  IconGithub,
  IconGroup,
  IconGraph,
  IconIssues,
  IconLink,
  IconList,
  IconLock,
  IconOpen,
  IconRepository,
  IconSearch,
  IconSeer,
  IconSettings,
  IconSiren,
  IconStar,
  IconSubscribed,
  IconTerminal,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {QUERY_API_CLIENT} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useMutateUserOptions} from 'sentry/utils/useMutateUserOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {DEFAULT_PREBUILT_SORT} from 'sentry/views/dashboards/manage/settings';
import {DashboardFilter} from 'sentry/views/dashboards/types';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';
import {
  MAX_STARRED_SAVED_QUERIES_IN_NAV,
  useGetSavedQueries,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {getSavedQueryTraceItemUrl} from 'sentry/views/explore/utils';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MCP_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mcp/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {useStarredIssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/useStarredIssueViews';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
import {getNavigationConfiguration} from 'sentry/views/settings/project/navigationConfiguration';
import {PROJECT_SETTINGS_ICONS} from 'sentry/views/settings/project/projectSettingsCommandPaletteActions';
import type {NavigationGroupProps} from 'sentry/views/settings/types';

import {CMDKAction} from './cmdk';
import type {CMDKResourceContext} from './cmdk';
import {CommandPaletteSlot} from './commandPaletteSlot';

const DSN_ICONS: React.ReactElement[] = [
  <IconIssues key="issues" />,
  <IconSettings key="settings" />,
  <IconList key="list" />,
];

const ORG_SETTINGS_ICONS: Record<string, React.ReactElement> = {
  '/settings/:orgId/api-keys/': <IconLock />,
  '/settings/:orgId/auth-tokens/': <IconLock />,
  '/settings/:orgId/feature-flags/': <IconFlag />,
  '/settings/:orgId/projects/': <IconAllProjects />,
  '/settings/:orgId/integrations/': <IconLink />,
  '/settings/:orgId/mcp-cli/': <IconTerminal />,
  '/settings/:orgId/members/': <IconUser />,
  '/settings/:orgId/repos/': <IconRepository />,
  '/settings/:orgId/seer/': <IconSeer />,
  '/settings/:orgId/teams/': <IconGroup />,
  '/settings/account/notifications/': <IconSubscribed />,
};

const helpSearch = new SentryGlobalSearch(['docs', 'develop']);

function renderAsyncResult(item: CommandPaletteAction, index: number) {
  if ('to' in item) {
    return <CMDKAction key={index} {...item} />;
  }
  if ('onAction' in item) {
    return <CMDKAction key={index} {...item} />;
  }
  return null;
}

/**
 * Registers globally-available actions into the CMDK collection via JSX.
 * Must be mounted inside CMDKProvider (which requires CommandPaletteStateProvider).
 */
export function GlobalCommandPaletteActions() {
  const organization = useOrganization();
  const user = useUser();
  const {projects} = useProjects();
  const params = useParams();
  const location = useLocation();
  const {mutateAsync: mutateUserOptions} = useMutateUserOptions();
  const {starredViews} = useStarredIssueViews();
  const {data: starredDashboards = []} = useGetStarredDashboards();
  const {mutate: exitSuperuser} = useMutation({
    mutationFn: () =>
      QUERY_API_CLIENT.requestPromise('/auth/superuser/', {method: 'DELETE'}),
    onSuccess: () => window.location.reload(),
  });

  const {data: starredSavedQueries = []} = useGetSavedQueries({
    starred: true,
    perPage: MAX_STARRED_SAVED_QUERIES_IN_NAV,
  });

  const {openSeerExplorer} = useSeerExplorerContext();

  const queryProjectIds = new Set(decodeList(location.query.project));
  const currentProjects = params.projectId
    ? projects.filter(p => p.slug === params.projectId)
    : projects.filter(p => queryProjectIds.has(p.id));
  const currentProjectSlugs = new Set(currentProjects.map(p => p.slug));
  const visibleProjectSettingsNavItems = useMemo(() => {
    const context: Omit<NavigationGroupProps, 'items' | 'name' | 'id'> = {
      access: new Set(organization.access),
      features: new Set(organization.features),
      organization,
    };
    return getNavigationConfiguration({
      organization,
    })
      .flatMap(section =>
        section.items.filter(navItem => {
          if (navItem.show === undefined) return true;
          return typeof navItem.show === 'function'
            ? navItem.show({...context, ...section})
            : navItem.show;
        })
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [organization]);

  const hasDsnLookup = organization.features.includes('cmd-k-dsn-lookup');
  const prefix = `/organizations/${organization.slug}`;
  const hasInsightsRollout = organization.features.includes(
    'insights-to-dashboards-ui-rollout'
  );
  const hasWorkflowEngineUI = organization.features.includes('workflow-engine-ui');
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );
  const hasMetricsSupportedPlatform = projects.some(project =>
    Array.from(limitedMetricsSupportPrefixes).some(metricsPrefix =>
      (project.platform || 'unknown').startsWith(metricsPrefix)
    )
  );
  return (
    <CommandPaletteSlot name="global">
      <CMDKAction display={{label: t('Go to...')}}>
        <CMDKAction display={{label: t('Issues'), icon: <IconIssues />}}>
          <CMDKAction display={{label: t('Feed')}} to={`${prefix}/issues/`} />
          {Object.values(ISSUE_TAXONOMY_CONFIG)
            .filter(
              ({featureFlag}) =>
                !featureFlag || organization.features.includes(featureFlag)
            )
            .map(config => (
              <CMDKAction
                key={config.key}
                display={{label: config.label}}
                to={`${prefix}/issues/${config.key}/`}
              />
            ))}
          <CMDKAction
            display={{label: t('User Feedback')}}
            to={`${prefix}/issues/feedback/`}
          />
          {organization.features.includes('seer-autopilot') && (
            <CMDKAction
              display={{label: t('Instrumentation')}}
              to={`${prefix}/issues/instrumentation/`}
            />
          )}
          <CMDKAction display={{label: t('All Views')}} to={`${prefix}/issues/views/`} />
          {starredViews.map(starredView => (
            <CMDKAction
              key={starredView.id}
              display={{label: starredView.label, icon: <IconStar />}}
              to={`${prefix}/issues/views/${starredView.id}/`}
            />
          ))}
          {organization.features.includes('seer-issue-view') && (
            <CMDKAction display={{label: t('Autofix')}}>
              <CMDKAction
                display={{label: t('Recently Run')}}
                to={`${prefix}/issues/autofix/recent/`}
              />
            </CMDKAction>
          )}
        </CMDKAction>

        <CMDKAction display={{label: t('Explore'), icon: <IconCompass />}}>
          <CMDKAction display={{label: t('Traces')}} to={`${prefix}/explore/traces/`} />
          {organization.features.includes('ourlogs-enabled') && (
            <CMDKAction display={{label: t('Logs')}} to={`${prefix}/explore/logs/`} />
          )}
          {hasMetricsSupportedPlatform &&
            organization.features.includes('tracemetrics-enabled') && (
              <CMDKAction
                display={{label: t('Metrics')}}
                to={`${prefix}/explore/metrics/`}
              />
            )}
          {organization.features.includes('explore-errors') && (
            <CMDKAction display={{label: t('Errors')}} to={`${prefix}/explore/errors/`} />
          )}
          <CMDKAction
            display={{label: t('Discover')}}
            to={`${prefix}/explore/discover/homepage/`}
          />
          {organization.features.includes('profiling') && (
            <CMDKAction
              display={{label: t('Profiles')}}
              to={`${prefix}/explore/profiling/`}
            />
          )}
          {organization.features.includes('session-replay-ui') && (
            <CMDKAction
              display={{label: t('Replays')}}
              to={`${prefix}/explore/replays/`}
            />
          )}
          <CMDKAction
            display={{label: t('Releases')}}
            to={`${prefix}/explore/releases/`}
          />
          {organization.features.includes('gen-ai-conversations') && (
            <CMDKAction
              display={{label: t('Conversations')}}
              to={`${prefix}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`}
            />
          )}
          <CMDKAction
            display={{label: t('All Queries')}}
            to={`${prefix}/explore/saved-queries/`}
          />
          {starredSavedQueries.map(query => (
            <CMDKAction
              key={query.id}
              display={{label: query.name, icon: <IconStar />}}
              to={getSavedQueryTraceItemUrl({savedQuery: query, organization})}
            />
          ))}
        </CMDKAction>

        <CMDKAction display={{label: t('Dashboards'), icon: <IconDashboard />}}>
          <CMDKAction
            display={{label: t('All Dashboards')}}
            to={`${prefix}/dashboards/`}
          />
          {hasPrebuiltDashboards && (
            <CMDKAction
              display={{label: t('Sentry Built')}}
              to={`${prefix}/dashboards/?filter=${DashboardFilter.ONLY_PREBUILT}&sort=${DEFAULT_PREBUILT_SORT}`}
            />
          )}
          <CMDKAction display={{label: t('Starred Dashboards'), icon: <IconStar />}}>
            {starredDashboards.map(dashboard => (
              <CMDKAction
                key={dashboard.id}
                display={{label: dashboard.title, icon: <IconStar />}}
                to={`${prefix}/dashboard/${dashboard.id}/`}
              />
            ))}
          </CMDKAction>
        </CMDKAction>

        {/* Hide the entire Insights section only when both migrations are active.
            During partial rollout, individual items are gated: domain links
            (Frontend, Backend, etc.) by insights-to-dashboards-ui-rollout,
            and Crons/Uptime by workflow-engine-ui. */}
        {organization.features.includes('performance-view') &&
          !(hasInsightsRollout && hasWorkflowEngineUI) && (
            <CMDKAction
              display={{
                label: t('Insights'),
                icon: <IconGraph type="area" />,
              }}
            >
              {!hasInsightsRollout && (
                <CMDKAction
                  display={{label: t('Frontend')}}
                  to={`${prefix}/insights/${FRONTEND_LANDING_SUB_PATH}/`}
                />
              )}
              {!hasInsightsRollout && (
                <CMDKAction
                  display={{label: t('Backend')}}
                  to={`${prefix}/insights/${BACKEND_LANDING_SUB_PATH}/`}
                />
              )}
              {!hasInsightsRollout && (
                <CMDKAction
                  display={{label: t('Mobile')}}
                  to={`${prefix}/insights/${MOBILE_LANDING_SUB_PATH}/`}
                />
              )}
              {!hasInsightsRollout && (
                <CMDKAction
                  display={{label: t('Agents')}}
                  to={`${prefix}/insights/${AGENTS_LANDING_SUB_PATH}/`}
                />
              )}
              {!hasInsightsRollout && (
                <CMDKAction
                  display={{label: t('MCP')}}
                  to={`${prefix}/insights/${MCP_LANDING_SUB_PATH}/`}
                />
              )}
              {!hasWorkflowEngineUI && (
                <CMDKAction
                  display={{label: t('Crons')}}
                  to={`${prefix}/insights/crons/`}
                />
              )}
              {organization.features.includes('uptime') && !hasWorkflowEngineUI && (
                <CMDKAction
                  display={{label: t('Uptime')}}
                  to={`${prefix}/insights/uptime/`}
                />
              )}
              {!hasInsightsRollout && (
                <CMDKAction
                  display={{label: t('Projects')}}
                  to={`${prefix}/insights/projects/`}
                />
              )}
            </CMDKAction>
          )}

        {hasWorkflowEngineUI && (
          <CMDKAction display={{label: t('Monitors'), icon: <IconSiren />}}>
            <CMDKAction display={{label: t('All Monitors')}} to={`${prefix}/monitors/`} />
            <CMDKAction
              display={{label: t('My Monitors')}}
              to={`${prefix}/monitors/my-monitors/`}
            />
            <CMDKAction
              display={{label: t('Errors')}}
              to={`${prefix}/monitors/errors/`}
            />
            <CMDKAction
              display={{label: t('Metrics')}}
              to={`${prefix}/monitors/metrics/`}
            />
            <CMDKAction display={{label: t('Crons')}} to={`${prefix}/monitors/crons/`} />
            {organization.features.includes('uptime') && (
              <CMDKAction
                display={{label: t('Uptime')}}
                to={`${prefix}/monitors/uptime/`}
              />
            )}
            {organization.features.includes('preprod-size-monitors-frontend') && (
              <CMDKAction
                display={{label: t('Mobile Builds')}}
                to={`${prefix}/monitors/mobile-builds/`}
              />
            )}
            <CMDKAction
              display={{label: t('Alerts')}}
              to={`${prefix}/monitors/alerts/`}
            />
          </CMDKAction>
        )}

        <CMDKAction display={{label: t('Settings'), icon: <IconSettings />}}>
          {getUserOrgNavigationConfiguration()
            .flatMap(section => section.items)
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(item => (
              <CMDKAction
                key={item.path}
                display={{label: item.title, icon: ORG_SETTINGS_ICONS[item.path]}}
                to={item.path}
              />
            ))}
        </CMDKAction>

        <CMDKAction
          display={{label: t('Projects'), icon: <IconAllProjects />}}
          to={makeProjectsPathname({path: '/', organization})}
        />

        <CMDKAction display={{label: t('Project Settings'), icon: <IconSettings />}}>
          {visibleProjectSettingsNavItems.map(navItem => {
            const suffix = navItem.path.replace(
              '/settings/:orgId/projects/:projectId/',
              ''
            );
            return (
              <CMDKAction
                key={navItem.path}
                display={{label: navItem.title, icon: PROJECT_SETTINGS_ICONS[suffix]}}
                keywords={navItem.keywords}
                prompt={t('Select a project...')}
                resource={(
                  _query: string,
                  {state}: CMDKResourceContext
                ): CMDKQueryOptions =>
                  // `projects` is intentionally omitted from the queryKey:
                  // TanStack serializes the entire key for cache lookups, and
                  // including the full projects array would be too costly —
                  // some orgs have thousands of projects.
                  // `params.projectId`/`queryProjectIds` bust the cache when
                  // the active project changes (affects "Current" tag display).
                  // eslint-disable-next-line @tanstack/query/exhaustive-deps
                  cmdkQueryOptions({
                    queryKey: [
                      'project-settings',
                      organization.slug,
                      suffix,
                      params.projectId ?? [...queryProjectIds].join(','),
                    ],
                    queryFn: () => {
                      const sorted = [
                        ...projects.filter(p => currentProjectSlugs.has(p.slug)),
                        ...projects.filter(p => !currentProjectSlugs.has(p.slug)),
                      ];
                      return sorted.map(project => ({
                        display: {
                          label: project.slug,
                          icon: <ProjectAvatar project={project} size={16} />,
                          trailingItem: currentProjectSlugs.has(project.slug) ? (
                            <Tag variant="muted">{t('Current')}</Tag>
                          ) : undefined,
                        },
                        to: `/settings/${organization.slug}/projects/${project.slug}/${suffix}`,
                      }));
                    },
                    enabled: state === 'selected',
                    staleTime: Infinity,
                  })
                }
              />
            );
          })}
        </CMDKAction>
      </CMDKAction>

      {user.isStaff && (
        <CMDKAction display={{label: t('Admin')}}>
          <CMDKAction
            display={{label: t('Open _admin'), icon: <IconOpen />}}
            keywords={[t('superuser')]}
            onAction={() => window.open('/_admin/', '_blank', 'noreferrer')}
          />
          <CMDKAction
            display={{
              label: t('Open %s in _admin', organization.name),
              icon: <IconOpen />,
            }}
            keywords={[t('superuser')]}
            onAction={() =>
              window.open(
                `/_admin/customers/${organization.slug}/`,
                '_blank',
                'noreferrer'
              )
            }
          />
          {!isActiveSuperuser() && (
            <CMDKAction
              display={{label: t('Open Superuser Modal'), icon: <IconLock locked />}}
              keywords={[t('superuser')]}
              onAction={() => openSudo({isSuperuser: true, needsReload: true})}
            />
          )}
          {isActiveSuperuser() && (
            <CMDKAction
              display={{label: t('Exit Superuser'), icon: <IconLock locked={false} />}}
              keywords={[t('superuser')]}
              onAction={() => exitSuperuser()}
            />
          )}
          <CMDKAction
            display={{label: t('Night Shift Chats'), icon: <IconSeer />}}
            keywords={[
              t('seer'),
              t('ai'),
              t('chat'),
              t('agent'),
              t('explorer'),
              t('nightshift'),
              t('autofix'),
            ]}
            limit={10}
            resource={(): CMDKQueryOptions => {
              const url = getApiUrl(
                '/organizations/$organizationIdOrSlug/seer/explorer-runs/',
                {path: {organizationIdOrSlug: organization.slug}}
              );
              const query = {per_page: 10, category_key: 'night_shift', owner: 'false'};
              return cmdkQueryOptions({
                queryKey: [url, {query}],
                queryFn: () => QUERY_API_CLIENT.requestPromise(url, {query}),
                select: (data: {data: Array<{run_id: number; title: string}>}) =>
                  data.data.map(session => ({
                    display: {label: session.title, icon: <IconSeer />},
                    onAction: () => openSeerExplorer({runId: session.run_id}),
                  })),
                staleTime: 30_000,
              });
            }}
          >
            {data => data.map((item, i) => renderAsyncResult(item, i))}
          </CMDKAction>
        </CMDKAction>
      )}

      <CMDKAction display={{label: t('Add')}}>
        <CMDKAction
          display={{label: t('Create Dashboard'), icon: <IconAdd />}}
          keywords={[t('add dashboard')]}
          to={`${prefix}/dashboards/new/`}
        />
        <CMDKAction
          display={{label: t('Create Alert'), icon: <IconAdd />}}
          keywords={[t('add alert')]}
          to={`${prefix}/issues/alerts/wizard/`}
        />
        <CMDKAction
          display={{label: t('Create Project'), icon: <IconAdd />}}
          keywords={[t('add project')]}
          to={`${prefix}/projects/new/`}
        />
        <CMDKAction
          display={{label: t('Invite Members'), icon: <IconUser />}}
          keywords={[t('team invite')]}
          onAction={openInviteMembersModal}
        />
      </CMDKAction>

      <CMDKAction display={{label: t('DSN')}} keywords={[t('client keys')]}>
        {hasDsnLookup && (
          <CMDKAction
            display={{
              label: t('Reverse DSN lookup'),
              details: t(
                'Paste a DSN into the search bar to find the project it belongs to.'
              ),
              icon: <IconSearch />,
            }}
            prompt={t('Paste a DSN...')}
            resource={(query: string): CMDKQueryOptions => {
              return cmdkQueryOptions({
                ...apiOptions.as<DsnLookupResponse>()(
                  '/organizations/$organizationIdOrSlug/dsn-lookup/',
                  {
                    path: {organizationIdOrSlug: organization.slug},
                    query: {dsn: query},
                    staleTime: 30_000,
                  }
                ),
                enabled: DSN_PATTERN.test(query),
                select: data =>
                  getDsnNavTargets(data.json).map((target, i) => ({
                    to: target.to,
                    display: {
                      label: target.label,
                      details: target.description,
                      icon: DSN_ICONS[i],
                    },
                    keywords: [query],
                  })),
              });
            }}
          >
            {data => data.map((item, i) => renderAsyncResult(item, i))}
          </CMDKAction>
        )}
      </CMDKAction>

      <CMDKAction
        id="cmdk:supplementary:help"
        display={{label: t('Help')}}
        resource={(query: string): CMDKQueryOptions => {
          return cmdkQueryOptions({
            queryKey: ['command-palette-help-search', query, helpSearch],
            queryFn: () =>
              helpSearch.query(
                query,
                {searchAllIndexes: true},
                {analyticsTags: ['source:command-palette']}
              ),
            select: data => {
              const results = [];
              for (const index of data) {
                for (const hit of index.hits.slice(0, 3)) {
                  results.push({
                    display: {
                      label: DOMPurify.sanitize(hit.title ?? '', {ALLOWED_TAGS: []}),
                      details: DOMPurify.sanitize(
                        hit.context?.context1 ?? hit.context?.context2 ?? '',
                        {ALLOWED_TAGS: []}
                      ),
                      icon: <IconDocs />,
                    },
                    keywords: [hit.context?.context1, hit.context?.context2].filter(
                      (v): v is string => typeof v === 'string'
                    ),
                    to: hit.url,
                  });
                }
              }
              return results;
            },
          });
        }}
      >
        <CMDKAction
          display={{label: t('Open Documentation'), icon: <IconDocs />}}
          to="https://docs.sentry.io"
        />
        <CMDKAction
          display={{label: t('Join Discord'), icon: <IconDiscord />}}
          to="https://discord.gg/sentry"
        />
        <CMDKAction
          display={{label: t('Open GitHub Repository'), icon: <IconGithub />}}
          to="https://github.com/getsentry/sentry"
        />
        <CMDKAction
          display={{label: t('View Changelog'), icon: <IconOpen />}}
          to="https://sentry.io/changelog/"
        />
      </CMDKAction>

      <CMDKAction display={{label: t('Interface')}}>
        <CMDKAction display={{label: t('Change Color Theme'), icon: <IconSettings />}}>
          <CMDKAction
            display={{label: t('System')}}
            onAction={async () => {
              addLoadingMessage(t('Saving…'));
              await mutateUserOptions({theme: 'system'});
              addSuccessMessage(t('Theme preference saved: System'));
            }}
          />
          <CMDKAction
            display={{label: t('Light')}}
            onAction={async () => {
              addLoadingMessage(t('Saving…'));
              await mutateUserOptions({theme: 'light'});
              addSuccessMessage(t('Theme preference saved: Light'));
            }}
          />
          <CMDKAction
            display={{label: t('Dark')}}
            onAction={async () => {
              addLoadingMessage(t('Saving…'));
              await mutateUserOptions({theme: 'dark'});
              addSuccessMessage(t('Theme preference saved: Dark'));
            }}
          />
        </CMDKAction>
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
