import {Fragment} from 'react';
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
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueOwnership} from 'sentry/types';
import {IssueAlertRuleConditionTemplate} from 'sentry/types/alerts';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {AlertProcedure, AlertTemplate} from 'sentry/views/alerts/blueprints/types';
import {IssueAlertRuleConfig} from 'sentry/views/alerts/rules/issue';
import RuleNodeList from 'sentry/views/alerts/rules/issue/ruleNodeList';
import {
  CHANGE_ALERT_CONDITION_IDS,
  CHANGE_ALERT_PLACEHOLDERS_LABELS,
} from 'sentry/views/alerts/utils/constants';

interface AlertBlueprintEditorFormProps {
  help: string;
  identifier: string;
  onSubmit: (data: any) => void;
  type: 'template' | 'procedure';
  procedure?: AlertProcedure;
  template?: AlertTemplate;
}

function AlertBlueprintEditorForm({
  type,
  identifier,
  procedure,
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

  const {data: ownership = {} as IssueOwnership} = useApiQuery<IssueOwnership>(
    [`/projects/${organization.slug}/${project.slug}/ownership/`],
    {staleTime: 0}
  );

  const typeText = capitalize(type);

  const pageTitle = identifier === 'new' ? `New ${typeText}` : `Editing ${typeText}`;

  function renderNodeList() {
    return type === 'procedure' ? (
      <RuleNodeList
        nodes={configs?.actions ?? null}
        selectType="grouped"
        items={procedure?.issue_alert_actions ?? []}
        placeholder={t('Add action...')}
        organization={organization}
        project={project}
        ownership={ownership}
        disabled={false}
        onPropertyChange={() => {}}
        onAddRow={() => {}}
        onResetRow={() => {}}
        onDeleteRow={() => {}}
        error={() => {}}
        // onPropertyChange={this.handleChangeActionProperty}
        // onAddRow={this.handleAddAction}
        // onResetRow={this.handleResetAction}
        // onDeleteRow={this.handleDeleteAction}
        // error={
        //   this.hasError('actions') && (
        //     <StyledAlert type="error">{detailedError?.actions[0]}</StyledAlert>
        //   )
        // }
      />
    ) : (
      <Fragment>
        <RuleNodeList
          nodes={
            configs?.conditions?.map(condition =>
              CHANGE_ALERT_CONDITION_IDS.includes(condition.id)
                ? ({
                    ...condition,
                    label: CHANGE_ALERT_PLACEHOLDERS_LABELS[condition.id],
                  } as IssueAlertRuleConditionTemplate)
                : condition
            ) ?? null
          }
          items={template?.issue_alert_data?.conditions ?? []}
          selectType="grouped"
          placeholder={t('Add triggers...')}
          onPropertyChange={() => {}} // )handleChangeFilterProperty}
          onAddRow={() => {}} // )handleAddFilter}
          onResetRow={() => {}} // )handleResetFilter}
          onDeleteRow={() => {}} // )handleDeleteFilter}
          organization={organization}
          project={project}
          disabled={false}
          error={() => {}}
          // error={
          //   this.hasError('conditions') && (
          //     <StyledAlert type="error">
          //       {detailedError?.conditions[0]}
          //       {(detailedError?.conditions[0] || '').startsWith(
          //         'You may not exceed'
          //       ) && (
          //         <Fragment>
          //           {' '}
          //           <ExternalLink href="https://docs.sentry.io/product/alerts/create-alerts/#alert-limits">
          //             {t('View Docs')}
          //           </ExternalLink>
          //         </Fragment>
          //       )}
          //     </StyledAlert>
          //   )
          // // // }
          // // incompatibleRules={incompatibleConditions}
          // // incompatibleBanner={
          // //   incompatibleFilters === null && incompatibleConditions !== null
          // //     ? incompatibleConditions.at(-1)
          // //     : null
          // }
        />

        <RuleNodeList
          nodes={configs?.filters ?? null}
          items={template?.issue_alert_data?.filters ?? []}
          placeholder={t('Add filters...')}
          onPropertyChange={() => {}} // )handleChangeFilterProperty}
          onAddRow={() => {}} // )handleAddFilter}
          onResetRow={() => {}} // )handleResetFilter}
          onDeleteRow={() => {}} // )handleDeleteFilter}
          organization={organization}
          project={project}
          disabled={false}
          error={() => {}}
          // error={
          //     this.hasError('filters') && (
          //       <StyledAlert type="error">{detailedError?.filters[0]}</StyledAlert>
          //     )
          //   }
          //   incompatibleRules={incompatibleFilters}
          //   incompatibleBanner={incompatibleFilters ? incompatibleFilters.at(-1) : null}
        />
      </Fragment>
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
              : procedure?.label || template?.name || null}
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
                />
                <TeamField organization={organization} onChange={() => {}} />
                <DescriptionField
                  name="description"
                  placeholder={t('(optional) Here is a description for this %s...', type)}
                />
              </EditorDetails>
              <EditorControls>
                <LinkButton to={`/organizations/${organization.slug}/alerts/${type}/`}>
                  {t('Cancel')}
                </LinkButton>
                <Button priority="primary" onClick={() => onSubmit({})}>
                  {t('Save %s', typeText)}
                </Button>
              </EditorControls>
            </EditorContent>
          </EditorGrouping>
        </Layout.Main>
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
