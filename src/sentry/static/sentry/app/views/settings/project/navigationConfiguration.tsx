import {t} from 'app/locale';
import {NavigationSection} from 'app/views/settings/types';
import {Organization, Project} from 'app/types';

type ConfigParams = {
  organization: Organization;
  project: Project;
};

const pathPrefix = '/settings/:orgId/projects/:projectId';

export default function getConfiguration({
  project,
  organization,
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
          title: t('Alerts'),
          description: t('Manage alert rules for a project'),
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
          path: `${pathPrefix}/debug-symbols/`,
          title: t('Debug Files'),
        },
        {
          path: `${pathPrefix}/source-maps/`,
          title: t('Source Maps'),
          show: () => organization.features?.includes('artifacts-in-settings'),
        },
        {
          path: `${pathPrefix}/proguard/`,
          title: t('ProGuard'),
          show: () => organization.features?.includes('android-mappings'),
        },
        {
          path: `${pathPrefix}/security-and-privacy/`,
          title: t('Security & Privacy'),
          description: t(
            'Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing)'
          ),
        },

        {
          path: `${pathPrefix}/processing-issues/`,
          title: t('Processing Issues'),
          // eslint-disable-next-line no-shadow
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
          path: `${pathPrefix}/filters/`,
          title: t('Inbound Filters'),
          description: t(
            "Configure a project's inbound filters (e.g. browsers, messages)"
          ),
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
          show: opts => opts?.access?.has('project:write'),
          id: 'plugin_details',
          recordAnalytics: true,
        })),
      ],
    },
  ];
}
