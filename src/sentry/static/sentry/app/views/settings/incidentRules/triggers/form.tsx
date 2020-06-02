import React from 'react';

import {Client} from 'app/api';
import {Config, Organization, Project} from 'app/types';
import {fetchOrgMembers} from 'app/actionCreators/members';
import {t, tct} from 'app/locale';
import ActionsPanel from 'app/views/settings/incidentRules/triggers/actionsPanel';
import Field from 'app/views/settings/components/forms/field';
import ThresholdControl from 'app/views/settings/incidentRules/triggers/thresholdControl';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';

import {
  AlertRuleThreshold,
  Trigger,
  Action,
  MetricActionTemplate,
  ThresholdControlValue,
} from '../types';

type AlertRuleThresholdKey = {
  [AlertRuleThreshold.INCIDENT]: 'alertThreshold';
  [AlertRuleThreshold.RESOLUTION]: 'resolveThreshold';
};

type Props = {
  api: Client;
  config: Config;
  disabled: boolean;
  organization: Organization;

  /**
   * Map of fieldName -> errorMessage
   */
  error?: {[fieldName: string]: string};
  projects: Project[];
  trigger: Trigger;
  triggerIndex: number;
  isCritical: boolean;

  onChange: (trigger: Trigger, changeObj: Partial<Trigger>) => void;
};

class TriggerForm extends React.PureComponent<Props> {
  getThresholdKey = (
    type: AlertRuleThreshold
  ): AlertRuleThresholdKey[AlertRuleThreshold] =>
    type === AlertRuleThreshold.RESOLUTION ? 'resolveThreshold' : 'alertThreshold';

  /**
   * Handler for threshold changes coming from slider or chart.
   * Needs to sync state with the form.
   */
  handleChangeThreshold = (type: AlertRuleThreshold, value: ThresholdControlValue) => {
    const {onChange, trigger} = this.props;

    const thresholdKey = this.getThresholdKey(type);

    onChange(
      {
        ...trigger,
        [thresholdKey]: value.threshold,
        thresholdType: value.thresholdType,
      },
      {[thresholdKey]: value.threshold}
    );
  };

  render() {
    const {disabled, error, trigger, isCritical} = this.props;
    const triggerLabel = isCritical
      ? t('Critical Trigger Threshold')
      : t('Warning Trigger Threshold');
    const resolutionLabel = isCritical
      ? t('Critical Resolution Threshold')
      : t('Warning Resolution Threshold');

    return (
      <React.Fragment>
        <Field
          label={triggerLabel}
          help={tct('The threshold that will activate the [severity] status', {
            severity: isCritical ? t('critical') : t('warning'),
          })}
          required
          error={error && error.alertThreshold}
        >
          <ThresholdControl
            disabled={disabled}
            type={AlertRuleThreshold.INCIDENT}
            thresholdType={trigger.thresholdType}
            threshold={trigger.alertThreshold}
            onChange={this.handleChangeThreshold}
          />
        </Field>

        <Field
          label={resolutionLabel}
          help={tct('The threshold that will de-activate the [severity] status', {
            severity: isCritical ? t('critical') : t('warning'),
          })}
          error={error && error.resolveThreshold}
        >
          <ThresholdControl
            disabled={disabled}
            type={AlertRuleThreshold.RESOLUTION}
            thresholdType={trigger.thresholdType}
            threshold={trigger.resolveThreshold}
            onChange={this.handleChangeThreshold}
          />
        </Field>
      </React.Fragment>
    );
  }
}

type TriggerFormContainerProps = Omit<
  React.ComponentProps<typeof TriggerForm>,
  'onChange'
> & {
  api: Client;
  availableActions: MetricActionTemplate[] | null;
  organization: Organization;
  currentProject: string;
  projects: Project[];
  trigger: Trigger;
  onChange: (triggerIndex: number, trigger: Trigger, changeObj: Partial<Trigger>) => void;
};

class TriggerFormContainer extends React.Component<TriggerFormContainerProps> {
  componentDidMount() {
    const {api, organization} = this.props;

    fetchOrgMembers(api, organization.slug);
  }

  handleChangeTrigger = (trigger: Trigger, changeObj: Partial<Trigger>) => {
    const {onChange, triggerIndex} = this.props;
    onChange(triggerIndex, trigger, changeObj);
  };

  handleAddAction = (action: Action) => {
    const {onChange, trigger, triggerIndex} = this.props;
    const actions = [...trigger.actions, action];
    onChange(triggerIndex, {...trigger, actions} as Trigger, {actions});
  };

  handleChangeActions = (actions: Action[]): void => {
    const {onChange, trigger, triggerIndex} = this.props;
    onChange(triggerIndex, {...trigger, actions}, {actions});
  };

  render() {
    const {
      api,
      availableActions,
      config,
      currentProject,
      disabled,
      error,
      isCritical,
      organization,
      trigger,
      triggerIndex,
      projects,
    } = this.props;

    return (
      <React.Fragment>
        <TriggerForm
          api={api}
          config={config}
          disabled={disabled}
          error={error}
          trigger={trigger}
          organization={organization}
          projects={projects}
          triggerIndex={triggerIndex}
          isCritical={isCritical}
          onChange={this.handleChangeTrigger}
        />
        <ActionsPanel
          disabled={disabled}
          loading={availableActions === null}
          error={false}
          availableActions={availableActions}
          currentProject={currentProject}
          organization={organization}
          projects={projects}
          triggerIndex={triggerIndex}
          actions={trigger.actions}
          onChange={this.handleChangeActions}
          onAdd={this.handleAddAction}
        />
      </React.Fragment>
    );
  }
}

export default withConfig(withApi(TriggerFormContainer));
