import {t} from '../../../locale';

const pathPrefix = '/settings/:orgId/:projectId';

export default function getConfiguration({project}) {
  let plugins = ((project && project.plugins) || []).filter(plugin => plugin.enabled);

  return [
    {
      name: t('Project'),
      items: [
        {
          path: `${pathPrefix}/settings/`,
          title: t('General Settings'),
        },
        {
          path: `${pathPrefix}/teams/`,
          title: t('Teams'),
        },
        {
          path: `${pathPrefix}/alerts/`,
          title: t('Alerts'),
        },
        {
          path: `${pathPrefix}/quotas/`,
          title: t('Rate Limits'),
          show: ({features}) => features.has('quotas'),
        },
        {
          path: `${pathPrefix}/tags/`,
          title: t('Tags'),
        },
        {
          path: `${pathPrefix}/environments/`,
          title: t('Environments'),
        },
        {
          path: `${pathPrefix}/issue-tracking/`,
          title: t('Issue Tracking'),
        },
        {
          path: `${pathPrefix}/release-tracking/`,
          title: t('Release Tracking'),
          show: ({access}) => access.has('project:write'),
        },
        {
          path: `${pathPrefix}/ownership/`,
          title: t('Issue Ownership'),
        },
        {
          path: `${pathPrefix}/data-forwarding/`,
          title: t('Data Forwarding'),
        },
        {
          path: `${pathPrefix}/saved-searches/`,
          title: t('Saved Searches'),
        },
        {
          path: `${pathPrefix}/debug-symbols/`,
          title: t('Debug Information Files'),
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
          path: `${pathPrefix}/csp/`,
          title: t('CSP Reports'),
        },
        {
          path: `${pathPrefix}/user-feedback/`,
          title: t('User Feedback'),
        },
        {
          path: `${pathPrefix}/filters/`,
          title: t('Inbound Filters'),
        },
        {
          path: `${pathPrefix}/keys/`,
          title: t('Client Keys (DSN)'),
        },
      ],
    },
    {
      name: t('Integrations'),
      items: [
        {
          path: `${pathPrefix}/plugins/`,
          title: t('All Integrations'),
        },
        ...plugins.map(plugin => ({
          path: `${pathPrefix}/plugins/${plugin.id}/`,
          title: plugin.name,
        })),
      ],
    },
  ];
}
