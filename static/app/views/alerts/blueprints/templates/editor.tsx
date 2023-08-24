import {Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {logException} from 'sentry/utils/logging';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import AlertBlueprintEditorForm from 'sentry/views/alerts/blueprints/form';
import {
  AlertDivider,
  AlertItem,
  AlertItemAvatar,
  AlertItemLink,
  AlertItemSubtitle,
} from 'sentry/views/alerts/blueprints/templates/summary';
import {AlertTemplate} from 'sentry/views/alerts/blueprints/types';

function AlertTemplateEditor() {
  const organization = useOrganization();
  const router = useRouter();
  const api = useApi();
  const {projects} = useProjects();
  // TODO(Leander): Do this operation once rather than every render of this component
  const projectsByIds = projects.reduce((m, p) => {
    m[p.id] = p;
    return m;
  }, {});
  const {templateId = 'new'} = router.params;

  const {data: template = {} as AlertTemplate} = useApiQuery<AlertTemplate>(
    [`/organizations/${organization.slug}/alert-templates/${templateId}/`],
    {staleTime: 0, enabled: templateId !== 'new'}
  );

  async function handleSubmit(data) {
    const path =
      templateId === 'new'
        ? `/organizations/${organization.slug}/alert-templates/`
        : `/organizations/${organization.slug}/alert-templates/${templateId}/`;

    const method = templateId === 'new' ? 'POST' : 'PUT';
    try {
      await api.requestPromise(path, {
        method,
        data: {
          owner: data?.owner ?? null,
          issue_alerts: data.alerts ?? [],
          issue_alert_data: {
            conditions: data.conditions,
            filters: data.filters,
            filterMatch: data.filterMatch,
            actionMatch: data.actionMatch,
            frequency: data.frequency,
          },
          is_manual: false,
          name: data.name,
          description: data.description,
        },
      });
      addSuccessMessage(t('Saved template!'));
    } catch (err) {
      logException(err);
      addErrorMessage(t('Unable to save template'));
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(err.responseJSON));
    }
  }
  const {issue_alerts: alerts = []} = template;

  return (
    <AlertBlueprintEditorForm
      type="template"
      template={template}
      identifier={templateId}
      help={t('Setup a standard series of actions for Sentry to run for you')}
      onSubmit={handleSubmit}
      aside={
        <SidebarSection.Wrap>
          <SidebarSection.Title>
            {t('Alerts using this template')}
            <QuestionTooltip
              title={t('These alerts will update when saving this template')}
              size="xs"
            />
          </SidebarSection.Title>
          <SidebarSection.Content>
            {alerts.map((a, i) => {
              const project = projectsByIds[a.project];
              const link = `/organizations/${organization.slug}/alerts/rules/${project.slug}/${a.id}/details/`;
              return (
                <Fragment key={i}>
                  <AlertItem>
                    <AlertItemAvatar size={25} project={project} />
                    <AlertItemLink to={link}>{a.name}</AlertItemLink>
                    <AlertItemSubtitle>{project.name}</AlertItemSubtitle>
                  </AlertItem>
                  {i !== alerts.length - 1 && <AlertDivider />}
                </Fragment>
              );
            })}
          </SidebarSection.Content>
        </SidebarSection.Wrap>
      }
    />
  );
}

export default AlertTemplateEditor;
