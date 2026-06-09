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
};

const pathPrefix = '/settings/:orgId/projects/:projectId';

export function getNavigationConfiguration({
  project,
  organization,
  debugFilesNeedsReview,
}: ConfigParams): NavigationSection[] {
  const plugins = (
    'plugins' in (project ?? {}) ? ((project as DetailedProject)?.plugins ?? []) : []
  ).filter(plugin => plugin.enabled);
  const hasLegacyWebhookUI =
    organization?.features?.includes('legacy-webhook-ui') ?? false;
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  return [
    {
      id: 'settings-project',
      name: t('Project'),
      items: [
        {
          path: `${pathPrefix}/`,
          index: true,
          title: t('General Settings'),
          description: t('Configure general settings for a project'),
        },
        {
          path: `${pathPrefix}/teams/`,
          title: t('Project Teams'),
          description: t('Manage team access for a project'),
        },
        {
          path: `${pathPrefix}/alerts/`,
          title: t('Alert Settings'),
          keywords: [t('alert'), t('alerts')],
          description: t('Project alert settings'),
        },
        {
          path: `${pathPrefix}/tags/`,
          title: t('Tags & Context'),
          description: t("View and manage a project's tags and context"),
        },
        {
          path: `${pathPrefix}/environments/`,
          title: t('Environments'),
          keywords: [t('environment'), t('env'), t('staging'), t('production')],
          description: t('Manage environments in a project'),
        },
        {
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
          path: `${pathPrefix}/seer/`,
          title: t('Seer'),
        },
        {
          path: `${pathPrefix}/user-feedback/`,
          title: t('User Feedback'),
          show: () => !isSelfHostedErrorsOnly,
        },
        {
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
          path: `${pathPrefix}/security-and-privacy/`,
          title: t('Security & Privacy'),
          description: t(
            'Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing) for a project'
          ),
        },
        {
          path: `${pathPrefix}/issue-grouping/`,
          title: t('Issue Grouping'),
          keywords: [t('fingerprinting'), t('fingerprint rules')],
        },
        {
          path: `${pathPrefix}/debug-symbols/`,
          title: t('Debug Files'),
          keywords: [t('debug file'), t('debug files'), t('symbols'), t('dsyms')],
          badge: debugFilesNeedsReview ? () => 'warning' : undefined,
        },
        {
          path: `${pathPrefix}/proguard/`,
          title: t('ProGuard'),
        },
        {
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
          path: `${pathPrefix}/performance/`,
          title: t('Performance'),
          show: () =>
            !!organization?.features?.includes('performance-view') &&
            !isSelfHostedErrorsOnly,
        },

        {
          path: `${pathPrefix}/replays/`,
          title: t('Replays'),
          keywords: [t('session'), t('session replay'), t('replay')],
          show: () =>
            !!organization?.features?.includes('session-replay-ui') &&
            !isSelfHostedErrorsOnly,
        },
        {
          path: `${pathPrefix}/playstation/`,
          title: t('PlayStation'),
          show: () => !!(organization && hasTempestAccess(organization)) && !isSelfHosted,
        },
        {
          path: `${pathPrefix}/mobile-builds/`,
          title: t('Mobile Builds'),
          badge: () => 'new',
          keywords: [t('size'), t('size analysis'), t('build size'), t('app size')],
          description: t('Size analysis and build distribution configuration.'),
        },
        {
          path: `${pathPrefix}/snapshots/`,
          title: t('Snapshots'),
          badge: () => 'beta',
          show: () => !!organization?.features?.includes('preprod-snapshots'),
          description: t('Configure snapshot status checks and PR comments.'),
        },
      ],
    },
    {
      id: 'settings-sdk',
      name: t('SDK Setup'),
      items: [
        {
          path: `${pathPrefix}/keys/`,
          title: t('Client Keys (DSN)'),
          description: t("View and manage the project's client keys (DSN)"),
          keywords: [
            t('dsn'),
            // The SDK environment variable name (and its spaced form) that
            // developers search for. Not wrapped in t() — these are fixed
            // config/product tokens, not translatable prose.
            'SENTRY_DSN',
            'Sentry DSN',
            t('auth'),
            t('token'),
            t('client key'),
            t('dsn key'),
            t('allowed domains'),
          ],
        },
        {
          path: `${pathPrefix}/loader-script/`,
          title: t('Loader Script'),
          description: t("View and manage the project's Loader Script"),
        },
        {
          path: `${pathPrefix}/release-tracking/`,
          title: t('Releases'),
        },
        {
          path: `${pathPrefix}/security-headers/`,
          title: t('Security Headers'),
        },
      ],
    },
    {
      id: 'settings-legacy-integrations',
      name: t('Legacy Integrations'),
      items: [
        hasLegacyWebhookUI
          ? {
              path: `${pathPrefix}/legacy-webhooks/`,
              title: t('Webhooks (Legacy)'),
              id: 'webhook_details',
              recordAnalytics: true,
            }
          : {
              path: `${pathPrefix}/plugins/`,
              title: t('Legacy Integrations'),
              description: t('View, enable, and disable all integrations for a project'),
              id: 'legacy_integrations',
              recordAnalytics: true,
            },
        ...plugins
          .filter(plugin => !hasLegacyWebhookUI || plugin.id !== 'webhooks')
          .map(plugin => ({
            path: `${pathPrefix}/plugins/${plugin.id}/`,
            title: plugin.name,
            show: (opts: any) =>
              opts?.access?.has('project:write') && !plugin.isDeprecated,
            id: 'plugin_details',
            recordAnalytics: true,
          })),
      ],
    },
  ];
}
