import {SentryGlobalSearch} from '@sentry-internal/global-search';
import DOMPurify from 'dompurify';

import {ProjectAvatar} from '@sentry/scraps/avatar';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import type {
  CMDKQueryOptions,
  CommandPaletteAction,
} from 'sentry/components/commandPalette/types';
import {
  DSN_PATTERN,
  getDsnNavTargets,
} from 'sentry/components/search/sources/dsnLookupUtils';
import type {DsnLookupResponse} from 'sentry/components/search/sources/dsnLookupUtils';
import {
  IconAdd,
  IconCompass,
  IconDashboard,
  IconDiscord,
  IconDocs,
  IconGithub,
  IconGraph,
  IconIssues,
  IconList,
  IconLock,
  IconOpen,
  IconSearch,
  IconSettings,
  IconStar,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {QUERY_API_CLIENT, queryOptions, useMutation} from 'sentry/utils/queryClient';
import {useMutateUserOptions} from 'sentry/utils/useMutateUserOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MCP_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mcp/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {useStarredIssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/useStarredIssueViews';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';

import {CMDKAction} from './cmdk';
import {CommandPaletteSlot} from './commandPaletteSlot';

const DSN_ICONS: React.ReactElement[] = [
  <IconIssues key="issues" />,
  <IconSettings key="settings" />,
  <IconList key="list" />,
];

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
  const hasDsnLookup = organization.features.includes('cmd-k-dsn-lookup');
  const {projects} = useProjects();
  const {mutateAsync: mutateUserOptions} = useMutateUserOptions();
  const {starredViews} = useStarredIssueViews();
  const {data: starredDashboards = []} = useGetStarredDashboards();
  const {mutate: exitSuperuser} = useMutation({
    mutationFn: () =>
      QUERY_API_CLIENT.requestPromise('/auth/superuser/', {method: 'DELETE'}),
    onSuccess: () => window.location.reload(),
  });

  const prefix = `/organizations/${organization.slug}`;

  return (
    <CommandPaletteSlot name="global">
      <CMDKAction display={{label: t('Go to...')}}>
        <CMDKAction display={{label: t('Issues'), icon: <IconIssues />}}>
          <CMDKAction display={{label: t('Feed')}} to={`${prefix}/issues/`} />
          {Object.values(ISSUE_TAXONOMY_CONFIG).map(config => (
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
          <CMDKAction display={{label: t('All Views')}} to={`${prefix}/issues/views/`} />
          {starredViews.map(starredView => (
            <CMDKAction
              key={starredView.id}
              display={{label: starredView.label, icon: <IconStar />}}
              to={`${prefix}/issues/views/${starredView.id}/`}
            />
          ))}
        </CMDKAction>

        <CMDKAction display={{label: t('Explore'), icon: <IconCompass />}}>
          <CMDKAction display={{label: t('Traces')}} to={`${prefix}/explore/traces/`} />
          {organization.features.includes('ourlogs-enabled') && (
            <CMDKAction display={{label: t('Logs')}} to={`${prefix}/explore/logs/`} />
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
          <CMDKAction
            display={{label: t('All Queries')}}
            to={`${prefix}/explore/saved-queries/`}
          />
        </CMDKAction>

        <CMDKAction display={{label: t('Dashboards'), icon: <IconDashboard />}}>
          <CMDKAction
            display={{label: t('All Dashboards')}}
            to={`${prefix}/dashboards/`}
          />
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

        {organization.features.includes('performance-view') && (
          <CMDKAction display={{label: t('Insights'), icon: <IconGraph type="area" />}}>
            <CMDKAction
              display={{label: t('Frontend')}}
              to={`${prefix}/insights/${FRONTEND_LANDING_SUB_PATH}/`}
            />
            <CMDKAction
              display={{label: t('Backend')}}
              to={`${prefix}/insights/${BACKEND_LANDING_SUB_PATH}/`}
            />
            <CMDKAction
              display={{label: t('Mobile')}}
              to={`${prefix}/insights/${MOBILE_LANDING_SUB_PATH}/`}
            />
            <CMDKAction
              display={{label: t('Agents')}}
              to={`${prefix}/insights/${AGENTS_LANDING_SUB_PATH}/`}
            />
            <CMDKAction
              display={{label: t('MCP')}}
              to={`${prefix}/insights/${MCP_LANDING_SUB_PATH}/`}
            />
            <CMDKAction display={{label: t('Crons')}} to={`${prefix}/insights/crons/`} />
            {organization.features.includes('uptime') && (
              <CMDKAction
                display={{label: t('Uptime')}}
                to={`${prefix}/insights/uptime/`}
              />
            )}
            <CMDKAction
              display={{label: t('All Projects')}}
              to={`${prefix}/insights/projects/`}
            />
          </CMDKAction>
        )}

        <CMDKAction display={{label: t('Settings'), icon: <IconSettings />}}>
          {getUserOrgNavigationConfiguration().flatMap(section =>
            section.items.map(item => (
              <CMDKAction key={item.path} display={{label: item.title}} to={item.path} />
            ))
          )}
        </CMDKAction>

        <CMDKAction display={{label: t('Project Settings'), icon: <IconSettings />}}>
          {projects.map(project => (
            <CMDKAction
              key={project.id}
              display={{
                label: project.name,
                icon: <ProjectAvatar project={project} size={16} />,
              }}
              to={`/settings/${organization.slug}/projects/${project.slug}/`}
            />
          ))}
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
        <CMDKAction
          display={{label: t('Project DSN Keys'), icon: <IconLock locked />}}
          keywords={[t('client keys'), t('dsn keys')]}
        >
          {projects.map(project => (
            <CMDKAction
              key={project.id}
              display={{
                label: project.name,
                icon: <ProjectAvatar project={project} size={16} />,
              }}
              keywords={[`dsn ${project.name}`, `dsn ${project.slug}`]}
              to={`/settings/${organization.slug}/projects/${project.slug}/keys/`}
            />
          ))}
        </CMDKAction>
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
              return queryOptions({
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
            {data => {
              return data.map((item, i) => renderAsyncResult(item, i));
            }}
          </CMDKAction>
        )}
      </CMDKAction>

      <CMDKAction display={{label: t('Help')}}>
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
        <CMDKAction
          display={{label: t('Search Results')}}
          resource={(query: string): CMDKQueryOptions => {
            return queryOptions({
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
          {data => data.map((item, i) => renderAsyncResult(item, i))}
        </CMDKAction>
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
