import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {NavigationSection} from 'sentry/views/settings/types';

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
  const plugins = ((project && project.plugins) || []).filter(plugin => plugin.enabled);
  return [
    {
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
          title: t('Tags'),
          description: t("View and manage a  project's tags"),
        },
        {
          path: `${pathPrefix}/environments/`,
          title: t('Environments'),
          description: t('Manage environments in a project'),
        },
        {
          path: `${pathPrefix}/ownership/`,
          title: t('Issue Owners'),
          description: t('Manage issue ownership rules for a project'),
        },
        {
          path: `${pathPrefix}/data-forwarding/`,
          title: t('Data Forwarding'),
        },
      ],
    },
    {
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
          path: `${pathPrefix}/dynamic-sampling/`,
          title: t('Dynamic Sampling'),
          show: () => {
            const orgFeatures = organization?.features ?? [];
            if (
              orgFeatures.includes('server-side-sampling') &&
              (orgFeatures.includes('dynamic-sampling-deprecated') ||
                orgFeatures.includes('dynamic-sampling'))
            ) {
              return true;
            }

            return false;
          },
          description: t(
            "Per-Project basis solution to configure sampling rules within Sentry's UI"
          ),
          badge: () => 'beta',
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
          path: `${pathPrefix}/processing-issues/`,
          title: t('Processing Issues'),
          // eslint-disable-next-line @typescript-eslint/no-shadow
          badge: ({project}) => {
            if (!project) {
              return null;
            }
            if (project.processingIssues <= 0) {
              return null;
            }
            return project.processingIssues > 99 ? '99+' : project.processingIssues;
          },
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
          show: () => !!organization?.features?.includes('performance-view'),
        },
      ],
    },
    {
      name: t('SDK Setup'),
      items: [
        {
          path: `${pathPrefix}/install/`,
          title: t('Instrumentation'),
        },
        {
          path: `${pathPrefix}/keys/`,
          title: t('Client Keys (DSN)'),
          description: t("View and manage the project's client keys (DSN)"),
        },
        {
          path: `${pathPrefix}/release-tracking/`,
          title: t('Releases'),
        },
        {
          path: `${pathPrefix}/security-headers/`,
          title: t('Security Headers'),
        },
        {
          path: `${pathPrefix}/user-feedback/`,
          title: t('User Feedback'),
          description: t('Configure user feedback reporting feature'),
        },
      ],
    },
    {
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
          show: opts => opts?.access?.has('project:write') && !plugin.isDeprecated,
          id: 'plugin_details',
          recordAnalytics: true,
        })),
      ],
    },
  ];
}
