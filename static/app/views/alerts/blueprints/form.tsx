import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import Breadcrumbs, {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import {Button, LinkButton} from 'sentry/components/button';
import Textarea from 'sentry/components/forms/controls/textarea';
import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import Input from 'sentry/components/input';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TeamSelector} from 'sentry/components/teamSelector';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import AlertProcedureNodeForm from 'sentry/views/alerts/blueprints/procedures/form';
import AlertTemplateNodeForm from 'sentry/views/alerts/blueprints/templates/form';
import {AlertProcedure, AlertTemplate} from 'sentry/views/alerts/blueprints/types';
import {
  defaultRule,
  getInitialValue,
  IssueAlertRuleConfig,
} from 'sentry/views/alerts/rules/issue';

interface AlertBlueprintEditorFormProps {
  help: string;
  identifier: string;
  onSubmit: (data: any) => void;
  type: 'template' | 'procedure';
  aside?: React.ReactNode;
  procedure?: AlertProcedure;
  template?: AlertTemplate;
}

function AlertBlueprintEditorForm({
  type,
  identifier,
  procedure,
  aside,
  template,
  help,
  onSubmit,
}: AlertBlueprintEditorFormProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  // HACK(Leander): Can't unravel project dependency yet
  const project = projects[0];
  const {data: configs = {} as IssueAlertRuleConfig} = useApiQuery<IssueAlertRuleConfig>(
    [`/projects/${organization.slug}/${project.slug}/rules/configuration/`],
    {staleTime: 0}
  );

  const [nodeData, setNodeData] = useState<any>({
    actions: procedure?.issue_alert_actions ?? [],
    filters: template?.issue_alert_data?.filters ?? [],
    conditions: template?.issue_alert_data?.conditions ?? [],
    filterMatch: template?.issue_alert_data?.filterMatch ?? defaultRule.filterMatch,
    actionMatch: template?.issue_alert_data?.actionMatch ?? defaultRule.actionMatch,
    frequency: template?.issue_alert_data?.frequency ?? defaultRule.frequency,
    name: procedure?.label ?? template?.name,
    description: procedure?.description ?? template?.description,
    owner: procedure?.owner ?? template?.owner,
  });

  useEffect(() => {
    setNodeData(nd => ({
      ...nd,
      ...{
        alerts: template?.issue_alerts?.map(a => a.id) ?? [],
        actions: procedure?.issue_alert_actions ?? [],
        filters: template?.issue_alert_data?.filters ?? [],
        conditions: template?.issue_alert_data?.conditions ?? [],
        filterMatch: template?.issue_alert_data?.filterMatch ?? defaultRule.filterMatch,
        actionMatch: template?.issue_alert_data?.actionMatch ?? defaultRule.actionMatch,
        frequency: template?.issue_alert_data?.frequency ?? defaultRule.frequency,
        name: procedure?.label ?? template?.name,
        description: procedure?.description ?? template?.description,
        owner: procedure?.owner ?? template?.owner,
      },
    }));
  }, [template, procedure]);

  const typeText = capitalize(type);
  const pageTitle = identifier === 'new' ? `New ${typeText}` : `Editing ${typeText}`;

  function handleNodeUpdate(
    keyType: 'conditions' | 'actions' | 'filters',
    action: 'add' | 'change' | 'delete',
    {ruleIndex, prop, val}: any
  ) {
    const records = [...nodeData[keyType]] ?? [];
    switch (action) {
      case 'add':
        records.push({
          ...getInitialValue(organization, configs, keyType, val.id),
          id: val.id,
          sentryAppInstallationUuid: val.sentryAppInstallationUuid,
        });
        setNodeData({...nodeData, [keyType]: records});
        break;
      case 'change':
        records[ruleIndex][prop] = val;
        setNodeData({...nodeData, [keyType]: records});
        break;
      case 'delete':
        records.splice(ruleIndex, 1);
        setNodeData({...nodeData, [keyType]: records});
        break;
      default:
        return;
    }
  }

  function handleFieldUpdate(fieldName: string, value: any) {
    setNodeData({...nodeData, [fieldName]: value});
  }

  function renderNodeList() {
    return type === 'procedure' ? (
      <AlertProcedureNodeForm
        configs={configs}
        handleNodeUpdate={handleNodeUpdate}
        project={project}
        organization={organization}
        nodeData={nodeData}
      />
    ) : (
      <AlertTemplateNodeForm
        configs={configs}
        handleNodeUpdate={handleNodeUpdate}
        handleFieldUpdate={handleFieldUpdate}
        project={project}
        organization={organization}
        nodeData={nodeData}
      />
    );
  }

  const crumbs: (Crumb | CrumbDropdown)[] = [
    {
      to: `/organizations/${organization.slug}/alerts/rules/`,
      label: t('Alerts'),
      preservePageFilters: true,
    },
    {
      to: `/organizations/${organization.slug}/alerts/${type}s/`,
      label: t('Alert %ss', typeText),
      preservePageFilters: true,
    },
    {label: pageTitle},
  ];

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Alert %s', typeText)} orgSlug={organization.slug} />
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs crumbs={crumbs} />
          <Layout.Title>
            {identifier === 'new'
              ? `Create a new ${type}`
              : procedure?.label ?? template?.name ?? null}
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main>
          <EditorGrouping>
            <EditorHeading>
              {t('Configure %s', type)}
              <FieldHelp>{help}</FieldHelp>
            </EditorHeading>
            <EditorContent>{renderNodeList()}</EditorContent>
          </EditorGrouping>
          <EditorGrouping>
            <EditorHeading>
              <div>{t('Set name, description and owner')}</div>
              <FieldHelp>
                {t("Help your teammates understand this %s's goal", type)}
              </FieldHelp>
            </EditorHeading>
            <EditorContent>
              <EditorDetails>
                <NameField
                  name={`${type}-name`}
                  placeholder={t('Enter %s name', type)}
                  autoComplete="off"
                  onChange={e => handleFieldUpdate('name', e.target.value)}
                  value={nodeData?.name}
                />
                <TeamField
                  includeUnassigned
                  organization={organization}
                  onChange={opt => handleFieldUpdate('owner', `team:${opt.value}`)}
                  useId
                  value={nodeData.owner ? nodeData.owner.split(':')[1] : null}
                />
                <DescriptionField
                  name="description"
                  placeholder={t('(optional) Here is a description for this %s...', type)}
                  onChange={e => handleFieldUpdate('description', e.target.value)}
                  value={nodeData?.description}
                />
              </EditorDetails>
              <EditorControls>
                <LinkButton to={`/organizations/${organization.slug}/alerts/${type}/`}>
                  {t('Cancel')}
                </LinkButton>
                <Button priority="primary" onClick={() => onSubmit(nodeData)}>
                  {t('Save %s', typeText)}
                  {type === 'template' && template?.issue_alerts?.length
                    ? tn(
                        ' and apply to alert',
                        ' and apply to %s alerts',
                        (template?.issue_alerts ?? []).length
                      )
                    : null}
                </Button>
              </EditorControls>
            </EditorContent>
          </EditorGrouping>
        </Layout.Main>
        <Layout.Side>{aside}</Layout.Side>
      </Layout.Body>
    </Fragment>
  );
}

const EditorHeading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  position: relative;
  align-items: center;
  padding-left: ${space(1.5)};
  &::before {
    content: '';
    position: absolute;
    height: 100%;
    width: 5px;
    right: 100%;
    border-radius: 1000px;
    background-color: ${p => p.theme.purple300};
  }
`;

const EditorGrouping = styled('div')`
  margin-bottom: ${space(4)};
`;

const EditorContent = styled('div')`
  padding-left: ${space(2)};
`;
const EditorControls = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${space(1)};
`;

const EditorDetails = styled('div')`
  display: grid;
  grid-template: auto auto / 2fr 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};
`;

const NameField = styled(Input)`
  grid-area: 1 / 1 / 2 / 2;
`;

const TeamField = styled(TeamSelector)`
  grid-area: 1 / 2 / 2 / 3;
`;

const DescriptionField = styled(Textarea)`
  grid-area: 2 / 1 / 3 / 3;
  height: 80px;
`;

export default AlertBlueprintEditorForm;
