import {Fragment} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {IssueAlertRuleConditionTemplate} from 'sentry/types/alerts';
import {
  ACTION_MATCH_OPTIONS,
  ACTION_MATCH_OPTIONS_MIGRATED,
  defaultRule,
  FREQUENCY_OPTIONS,
  IssueAlertRuleConfig,
} from 'sentry/views/alerts/rules/issue';
import RuleNodeList from 'sentry/views/alerts/rules/issue/ruleNodeList';
import {
  CHANGE_ALERT_CONDITION_IDS,
  CHANGE_ALERT_PLACEHOLDERS_LABELS,
} from 'sentry/views/alerts/utils/constants';

interface AlertTemplateNodeFormProps {
  configs: IssueAlertRuleConfig;
  // TODO(Leander): Fix these types
  handleFieldUpdate: any;
  handleNodeUpdate: any;
  nodeData: any;
  organization: Organization;
  project: Project;
}

function AlertTemplateNodeForm({
  configs,
  handleNodeUpdate,
  handleFieldUpdate,
  project,
  organization,
  nodeData,
}: AlertTemplateNodeFormProps) {
  return (
    <Fragment>
      <SectionHeading>
        {t('Conditions')}
        <FieldHelp>
          {tct('This template triggers when [selector] these conditions are met...', {
            selector: (
              <ActionMatchField>
                <SelectControl
                  name="actionMatch"
                  onChange={opt => handleFieldUpdate('actionMatch', opt.value)}
                  options={ACTION_MATCH_OPTIONS_MIGRATED}
                  value={nodeData?.actionMatch ?? 'all'}
                  size="xs"
                  disabled={false}
                />
              </ActionMatchField>
            ),
          })}
        </FieldHelp>
      </SectionHeading>
      <NodeSection>
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
          items={nodeData?.conditions ?? []}
          selectType="grouped"
          placeholder={t('Add conditions...')}
          onResetRow={() => {}}
          organization={organization}
          project={project}
          disabled={false}
          error={null}
          onPropertyChange={(ruleIndex, prop, val) =>
            handleNodeUpdate('conditions', 'change', {ruleIndex, prop, val})
          }
          onAddRow={val => handleNodeUpdate('conditions', 'add', {val})}
          onDeleteRow={ruleIndex => handleNodeUpdate('conditions', 'delete', {ruleIndex})}
        />
      </NodeSection>
      <SectionHeading>
        {t('Filters')}
        <FieldHelp>
          {tct('...and if [selector] these filters are satisfied...', {
            selector: (
              <ActionMatchField>
                <SelectControl
                  name="filterMatch"
                  onChange={opt => handleFieldUpdate('filterMatch', opt.value)}
                  options={ACTION_MATCH_OPTIONS}
                  value={nodeData?.filterMatch ?? 'all'}
                  size="xs"
                  disabled={false}
                />
              </ActionMatchField>
            ),
          })}
        </FieldHelp>
      </SectionHeading>
      <NodeSection>
        <RuleNodeList
          nodes={configs?.filters ?? null}
          items={nodeData?.filters ?? []}
          placeholder={t('Add filters...')}
          organization={organization}
          project={project}
          disabled={false}
          error={null}
          onPropertyChange={(ruleIndex, prop, val) =>
            handleNodeUpdate('filters', 'change', {ruleIndex, prop, val})
          }
          onAddRow={val => handleNodeUpdate('filters', 'add', {val})}
          onDeleteRow={ruleIndex => handleNodeUpdate('filters', 'delete', {ruleIndex})}
          onResetRow={() => {}}
        />
      </NodeSection>

      <SectionHeading>
        {t('Frequency')}
        <FieldHelp>
          {tct('...and only take action every [selector]', {
            selector: (
              <ActionMatchField>
                <SelectControl
                  name="frequency"
                  onChange={opt => handleFieldUpdate('frequency', opt.value)}
                  options={FREQUENCY_OPTIONS}
                  value={`${nodeData?.frequency}` ?? `${defaultRule.frequency}`}
                  size="xs"
                  disabled={false}
                />
              </ActionMatchField>
            ),
          })}
        </FieldHelp>
      </SectionHeading>
    </Fragment>
  );
}

const SectionHeading = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
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
    background-color: ${p => p.theme.charts.colors[8]};
  }
  margin: 0;
`;

const NodeSection = styled('section')`
  margin-bottom: ${space(1.5)};
`;

const ActionMatchField = styled('div')`
  padding: 0;
  font-weight: normal;
  text-transform: none;
  display: inline-block;
  width: 100px;
`;

export default AlertTemplateNodeForm;
