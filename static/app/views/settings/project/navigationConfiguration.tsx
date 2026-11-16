import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject, Project} from 'sentry/types/project';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import type {NavigationSection} from 'sentry/views/settings/types';

type ConfigParams = {
  debugFilesNeedsReview?: boolean;
  organization?: Organization;
  project?: DetailedProject | Project;
  /**
   * Whether the `settings-v3` navigation is enabled. The index item is titled
   * "General" instead of "General Settings".
   */
  settingsV3?: boolean;
};

const pathPrefix = '/settings/:orgId/projects/:projectId';

export function getNavigationConfiguration({
  organization,
  debugFilesNeedsReview,
  settingsV3,
}: ConfigParams): NavigationSection[] {
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  return [
    {
      id: 'settings-project',
      name: t('Project'),
      items: [
        {
          id: 'project_general',
          path: `${pathPrefix}/`,
          index: true,
          title: settingsV3 ? t('General') : t('General Settings'),
          description: t('Configure general settings for a project'),
        },
        {
          id: 'project_teams',
          path: `${pathPrefix}/teams/`,
          title: t('Project Teams'),
          description: t('Manage team access for a project'),
        },
        {
          id: 'project_alerts',
          path: `${pathPrefix}/alerts/`,
          title: t('Alert Settings'),
          keywords: [t('alert'), t('alerts')],
          description: t('Project alert settings'),
        },
        {
          id: 'project_tags',
          path: `${pathPrefix}/tags/`,
          title: t('Tags & Context'),
          description: t("View and manage a project's tags and context"),
        },
        {
          id: 'project_attributes',
          path: `${pathPrefix}/attributes/`,
          title: t('Attributes'),
          badge: () => 'beta',
          description: t("Browse a project's log, metric, and span attributes"),
          keywords: [t('attribute'), t('attributes')],
          show: () => !!organization?.features?.includes('attribute-management'),
        },
        {
          id: 'project_environments',
          path: `${pathPrefix}/environments/`,
          title: t('Environments'),
          keywords: [t('environment'), t('env'), t('staging'), t('production')],
          description: t('Manage environments in a project'),
        },
        {
          id: 'project_ownership',
          path: `${pathPrefix}/ownership/`,
          title: t('Ownership Rules'),
          keywords: [
            t('ownership'),
            t('codeowners'),
            t('code owners'),
            t('owners'),
            t('owner rules'),
          ],
          description: t('Manage ownership rules for a project'),
        },
        {
          id: 'project_seer',
          path: `${pathPrefix}/seer/`,
          title: t('Seer'),
          show: () => !isSelfHosted,
        },
        {
          id: 'project_user_feedback',
          path: `${pathPrefix}/user-feedback/`,
          title: t('User Feedback'),
          show: () => !isSelfHostedErrorsOnly,
        },
        {
          id: 'project_toolbar',
          path: `${pathPrefix}/toolbar/`,
          title: t('Dev Toolbar'),
          badge: () => 'beta',
        },
      ],
    },
    {
      id: 'settings-processing',
      name: t('Processing'),
      items: [
        {
          id: 'project_filters',
          path: `${pathPrefix}/filters/`,
          title: t('Inbound Filters'),
          keywords: [
            t('inbound'),
            t('filter'),
            t('filters'),
            t('discard'),
            t('ignore'),
            t('attachments'),
          ],
          description: t(
            "Configure a project's inbound filters (e.g. browsers, messages)"
          ),
        },
        {
          id: 'project_security_and_privacy',
          path: `${pathPrefix}/security-and-privacy/`,
          title: t('Security & Privacy'),
          description: t(
            'Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing) for a project'
          ),
        },
        {
          id: 'project_issue_grouping',
          path: `${pathPrefix}/issue-grouping/`,
          title: t('Issue Grouping'),
          keywords: [t('fingerprinting'), t('fingerprint rules')],
        },
        {
          id: 'project_debug_symbols',
          path: `${pathPrefix}/debug-symbols/`,
          title: t('Debug Files'),
          keywords: [t('debug file'), t('debug files'), t('symbols'), t('dsyms')],
          badge: debugFilesNeedsReview ? () => 'warning' : undefined,
        },
        {
          id: 'project_proguard',
          path: `${pathPrefix}/proguard/`,
          title: t('ProGuard'),
        },
        {
          id: 'project_source_maps',
          path: `${pathPrefix}/source-maps/`,
          title: t('Source Maps'),
          keywords: [
            t('source map'),
            t('source maps'),
            t('sourcemap'),
            t('artifact bundles'),
          ],
        },
        {
          id: 'project_performance',
          path: `${pathPrefix}/performance/`,
          title: t('Performance'),
          show: () =>
            !!organization?.features?.includes('performance-view') &&
            !isSelfHostedErrorsOnly,
        },

        {
          id: 'project_replays',
          path: `${pathPrefix}/replays/`,
          title: t('Replays'),
          keywords: [t('session'), t('session replay'), t('replay')],
          show: () =>
            !!organization?.features?.includes('session-replay-ui') &&
            !isSelfHostedErrorsOnly,
        },
        {
          id: 'project_logs',
          path: `${pathPrefix}/logs/`,
          title: t('Logs'),
          badge: () => 'alpha',
          keywords: [t('log'), t('logs'), t('attributes'), t('json')],
          show: () =>
            !!organization?.features?.includes('explore-automatic-json-expansion-ui') &&
            !isSelfHostedErrorsOnly,
        },
        {
          id: 'project_playstation',
          path: `${pathPrefix}/playstation/`,
          title: t('PlayStation'),
          show: () => !!(organization && hasTempestAccess(organization)) && !isSelfHosted,
        },
        {
          id: 'project_mobile_builds',
          path: `${pathPrefix}/mobile-builds/`,
          title: t('Mobile Builds'),
          badge: () => 'new',
          keywords: [t('size'), t('size analysis'), t('build size'), t('app size')],
          description: t('Size analysis and build distribution configuration.'),
        },
        {
          id: 'project_snapshots',
          path: `${pathPrefix}/snapshots/`,
          title: t('Snapshots'),
          badge: () => 'beta',
          description: t('Configure snapshot status checks and PR comments.'),
        },
      ],
    },
    {
      id: 'settings-sdk',
      name: t('SDK Setup'),
      items: [
        {
          id: 'project_keys',
          path: `${pathPrefix}/keys/`,
          title: t('Client Keys (DSN)'),
          description: t("View and manage the project's client keys (DSN)"),
          keywords: [
            t('dsn'),
            // SDK environment variable names (and the spaced form) that
            // developers search for, including the Next.js public-prefixed
            // variant. Not wrapped in t() — these are fixed config/product
            // tokens, not translatable prose.
            'SENTRY_DSN',
            'Sentry DSN',
            'NEXT_PUBLIC_SENTRY_DSN',
            t('auth'),
            t('token'),
            t('client key'),
            t('dsn key'),
            t('allowed domains'),
          ],
        },
        {
          id: 'project_loader_script',
          path: `${pathPrefix}/loader-script/`,
          title: t('Loader Script'),
          description: t("View and manage the project's Loader Script"),
        },
        {
          id: 'project_release_tracking',
          path: `${pathPrefix}/release-tracking/`,
          title: t('Releases'),
        },
        {
          id: 'project_security_headers',
          path: `${pathPrefix}/security-headers/`,
          title: t('Security Headers'),
        },
      ],
    },
    {
      id: 'settings-legacy-integrations',
      name: t('Legacy Integrations'),
      items: [
        {
          path: `${pathPrefix}/legacy-webhooks/`,
          title: t('Webhooks (Legacy)'),
          id: 'webhook_details',
          recordAnalytics: true,
        },
      ],
    },
  ];
}
