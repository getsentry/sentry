import {t} from 'app/locale';

const pathPrefix = '/settings/:orgId/:projectId';

export default function getConfiguration({project}) {
  let plugins = ((project && project.plugins) || []).filter(plugin => plugin.enabled);

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
          description: t('Manage alerts and alert rules for a project'),
        },
        {
          path: `${pathPrefix}/quotas/`,
          title: t('Rate Limits'),
          show: ({features}) => features.has('quotas'),
          description: t("Configure project's rate limits"),
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
          path: `${pathPrefix}/issue-tracking/`,
          title: t('Issue Tracking'),
        },
        {
          path: `${pathPrefix}/release-tracking/`,
          title: t('Releases'),
          show: ({access}) => access.has('project:write'),
        },
        {
          path: `${pathPrefix}/ownership/`,
          title: t('Issue Owners'),
          description: t('Manage issue ownership rules for a project'),
          badge: () => 'new',
        },
        {
          path: `${pathPrefix}/data-forwarding/`,
          title: t('Data Forwarding'),
        },
        {
          path: `${pathPrefix}/saved-searches/`,
          title: t('Saved Searches'),
          description: t('Manage saved searches for a project and your account'),
        },
        {
          path: `${pathPrefix}/debug-symbols/`,
          title: t('Debug Files'),
        },
        {
          path: `${pathPrefix}/processing-issues/`,
          title: t('Processing Issues'),
          // eslint-disable-next-line no-shadow
          badge: ({project}) => {
            if (project.processingIssues <= 0) return null;
            return project.processingIssues > 99 ? '99+' : project.processingIssues;
          },
        },
      ],
    },
    {
      name: t('Data'),
      items: [
        {
          path: `${pathPrefix}/install/`,
          title: t('Error Tracking'),
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
        {
          path: `${pathPrefix}/filters/`,
          title: t('Inbound Filters'),
          description: t(
            "Configure a project's inbound filters (e.g. browsers, messages)"
          ),
        },
        {
          path: `${pathPrefix}/keys/`,
          title: t('Client Keys (DSN)'),
          description: t("View and manage the project's client keys (DSN)"),
        },
      ],
    },
    {
      name: t('Integrations'),
      items: [
        {
          path: `${pathPrefix}/plugins/`,
          title: t('All Integrations'),
          description: t('View, enable, and disable all integrations for a project'),
        },
        ...plugins.map(plugin => ({
          path: `${pathPrefix}/plugins/${plugin.id}/`,
          title: plugin.name,
        })),
      ],
    },
  ];
}
