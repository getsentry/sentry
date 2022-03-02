import {Component, Fragment} from 'react';

import {Panel, PanelBody} from 'sentry/components/panels';
import {Organization, Project} from 'sentry/types';
import {removeAtArrayIndex} from 'sentry/utils/removeAtArrayIndex';
import {replaceAtArrayIndex} from 'sentry/utils/replaceAtArrayIndex';
import ActionsPanel from 'sentry/views/alerts/incidentRules/triggers/actionsPanel';
import TriggerForm from 'sentry/views/alerts/incidentRules/triggers/form';

import {
  Action,
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  MetricActionTemplate,
  Trigger,
  UnsavedIncidentRule,
} from '../types';

type Props = {
  aggregate: UnsavedIncidentRule['aggregate'];
  availableActions: MetricActionTemplate[] | null;
  comparisonType: AlertRuleComparisonType;
  currentProject: string;
  disabled: boolean;
  errors: Map<number, {[fieldName: string]: string}>;
  hasAlertWizardV3: boolean;
  onChange: (
    triggers: Trigger[],
    triggerIndex?: number,
    changeObj?: Partial<Trigger>
  ) => void;
  onResolveThresholdChange: (
    resolveThreshold: UnsavedIncidentRule['resolveThreshold']
  ) => void;
  onThresholdPeriodChange: (value: number) => void;
  onThresholdTypeChange: (thresholdType: AlertRuleThresholdType) => void;
  organization: Organization;
  projects: Project[];

  resolveThreshold: UnsavedIncidentRule['resolveThreshold'];

  thresholdPeriod: UnsavedIncidentRule['thresholdPeriod'];
  thresholdType: UnsavedIncidentRule['thresholdType'];
  triggers: Trigger[];
  ruleId?: string;
};

/**
 * A list of forms to add, edit, and delete triggers.
 */
class Triggers extends Component<Props> {
  handleDeleteTrigger = (index: number) => {
    const {triggers, onChange} = this.props;
    const updatedTriggers = removeAtArrayIndex(triggers, index);

    onChange(updatedTriggers);
  };

  handleChangeTrigger = (
    triggerIndex: number,
    trigger: Trigger,
    changeObj: Partial<Trigger>
  ) => {
    const {triggers, onChange} = this.props;
    const updatedTriggers = replaceAtArrayIndex(triggers, triggerIndex, trigger);
    onChange(updatedTriggers, triggerIndex, changeObj);
  };

  handleAddAction = (triggerIndex: number, action: Action) => {
    const {onChange, triggers} = this.props;
    const trigger = triggers[triggerIndex];
    const actions = [...trigger.actions, action];
    const updatedTriggers = replaceAtArrayIndex(triggers, triggerIndex, {
      ...trigger,
      actions,
    });
    onChange(updatedTriggers, triggerIndex, {actions});
  };

  handleChangeActions = (
    triggerIndex: number,
    triggers: Trigger[],
    actions: Action[]
  ): void => {
    const {onChange} = this.props;
    const trigger = triggers[triggerIndex];
    const updatedTriggers = replaceAtArrayIndex(triggers, triggerIndex, {
      ...trigger,
      actions,
    });
    onChange(updatedTriggers, triggerIndex, {actions});
  };

  render() {
    const {
      availableActions,
      currentProject,
      errors,
      organization,
      projects,
      triggers,
      disabled,
      aggregate,
      thresholdType,
      thresholdPeriod,
      comparisonType,
      resolveThreshold,
      hasAlertWizardV3,
      onThresholdTypeChange,
      onResolveThresholdChange,
      onThresholdPeriodChange,
    } = this.props;

    // Note we only support 2 triggers max
    return (
      <Fragment>
        <Panel>
          <PanelBody>
            <TriggerForm
              disabled={disabled}
              errors={errors}
              organization={organization}
              projects={projects}
              triggers={triggers}
              aggregate={aggregate}
              resolveThreshold={resolveThreshold}
              thresholdType={thresholdType}
              thresholdPeriod={thresholdPeriod}
              comparisonType={comparisonType}
              hasAlertWizardV3={hasAlertWizardV3}
              onChange={this.handleChangeTrigger}
              onThresholdTypeChange={onThresholdTypeChange}
              onResolveThresholdChange={onResolveThresholdChange}
              onThresholdPeriodChange={onThresholdPeriodChange}
            />
          </PanelBody>
        </Panel>

        <ActionsPanel
          disabled={disabled}
          loading={availableActions === null}
          error={false}
          availableActions={availableActions}
          currentProject={currentProject}
          organization={organization}
          projects={projects}
          triggers={triggers}
          onChange={this.handleChangeActions}
          onAdd={this.handleAddAction}
        />
      </Fragment>
    );
  }
}

export default Triggers;
