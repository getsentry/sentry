import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import type {NavigationSection} from 'sentry/views/settings/types';

type ConfigParams = {
  debugFilesNeedsReview?: boolean;
  organization?: Organization;
  project?: Project;
};

const pathPrefix = '/settings/:orgId/projects/:projectId';

export default function getConfiguration({
  project,
  organization,
  debugFilesNeedsReview,
}: ConfigParams): NavigationSection[] {
  const plugins = (project?.plugins || []).filter(plugin => plugin.enabled);
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const hasRevampedDataForwarding = organization?.features?.includes(
    'data-forwarding-revamp-access'
  );
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
          description: t('Manage environments in a project'),
        },
        {
          path: `${pathPrefix}/ownership/`,
          title: t('Ownership Rules'),
          description: t('Manage ownership rules for a project'),
        },
        {
          path: `${pathPrefix}/data-forwarding/`,
          title: t('Data Forwarding'),
          show: () => !hasRevampedDataForwarding,
        },
        {
          path: `${pathPrefix}/seer/`,
          title: t('Seer'),
          show: () => !organization?.hideAiFeatures,
        },
        {
          path: `${pathPrefix}/user-feedback/`,
          title: t('User Feedback'),
          show: () => !isSelfHostedErrorsOnly,
        },
        {
          path: `${pathPrefix}/toolbar/`,
          title: t('Dev Toolbar'),
          show: () => !!organization?.features?.includes('sentry-toolbar-ui'),
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
        },
        {
          path: `${pathPrefix}/debug-symbols/`,
          title: t('Debug Files'),
          badge: debugFilesNeedsReview ? () => 'warning' : undefined,
        },
        {
          path: `${pathPrefix}/proguard/`,
          title: t('ProGuard'),
        },
        {
          path: `${pathPrefix}/source-maps/`,
          title: t('Source Maps'),
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
          path: `${pathPrefix}/preprod/`,
          title: t('Preprod'),
          show: () => !!organization?.features?.includes('preprod-issues'),
          badge: () => 'beta',
          description: t('Size analysis and build distribution configuration.'),
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
        {
          path: `${pathPrefix}/plugins/`,
          title: t('Legacy Integrations'),
          description: t('View, enable, and disable all integrations for a project'),
          id: 'legacy_integrations',
          recordAnalytics: true,
        },
        ...plugins.map(plugin => ({
          path: `${pathPrefix}/plugins/${plugin.id}/`,
          title: plugin.name,
          show: (opts: any) => opts?.access?.has('project:write') && !plugin.isDeprecated,
          id: 'plugin_details',
          recordAnalytics: true,
        })),
      ],
    },
  ];
}
