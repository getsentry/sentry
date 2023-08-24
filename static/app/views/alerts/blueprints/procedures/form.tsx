import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {IssueOwnership, Organization, Project} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {IssueAlertRuleConfig} from 'sentry/views/alerts/rules/issue';
import RuleNodeList from 'sentry/views/alerts/rules/issue/ruleNodeList';

interface AlertTemplateNodeFormProps {
  configs: IssueAlertRuleConfig;
  handleNodeUpdate: any;
  nodeData: any;
  organization: Organization;
  project: Project;
}

function AlertProcedureNodeForm({
  configs,
  handleNodeUpdate,
  project,
  organization,
  nodeData,
}: AlertTemplateNodeFormProps) {
  const {data: ownership = {} as IssueOwnership} = useApiQuery<IssueOwnership>(
    [`/projects/${organization.slug}/${project.slug}/ownership/`],
    {staleTime: 0}
  );

  return (
    <Fragment>
      <RuleNodeList
        nodes={configs?.actions ?? null}
        selectType="grouped"
        items={nodeData?.actions ?? []}
        placeholder={t('Add action...')}
        organization={organization}
        project={project}
        ownership={ownership}
        disabled={false}
        onResetRow={() => {}}
        error={null}
        onPropertyChange={(ruleIndex, prop, val) =>
          handleNodeUpdate('actions', 'change', {ruleIndex, prop, val})
        }
        onAddRow={val => handleNodeUpdate('actions', 'add', {val})}
        onDeleteRow={ruleIndex => handleNodeUpdate('actions', 'delete', {ruleIndex})}
      />
    </Fragment>
  );
}

export default AlertProcedureNodeForm;
