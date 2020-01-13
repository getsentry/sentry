import React from 'react';

import {Client} from 'app/api';
import {Config, Organization, Project} from 'app/types';
import {MetricAction} from 'app/types/alerts';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {fetchOrgMembers} from 'app/actionCreators/members';
import {t} from 'app/locale';
import ActionsPanel from 'app/views/settings/incidentRules/triggers/actionsPanel';
import Field from 'app/views/settings/components/forms/field';
import ThresholdControl from 'app/views/settings/incidentRules/triggers/thresholdControl';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';

import {AlertRuleThreshold, Trigger, Action, ThresholdControlValue} from '../types';

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

  onChange: (trigger: Trigger) => void;
};

class TriggerForm extends React.PureComponent<Props> {
  getThresholdKey = (
    type: AlertRuleThreshold
  ): AlertRuleThresholdKey[AlertRuleThreshold] =>
    type === AlertRuleThreshold.RESOLUTION ? 'resolveThreshold' : 'alertThreshold';

  /**
   * Checks to see if threshold is valid given target value, and state of
   * inverted threshold as well as the *other* threshold
   *
   * @param type The threshold type to be updated
   * @param value The new threshold value
   */
  canUpdateThreshold = (
    type: AlertRuleThreshold,
    value: ThresholdControlValue['threshold']
  ): boolean => {
    const {trigger} = this.props;
    const isResolution = type === AlertRuleThreshold.RESOLUTION;
    const otherKey = isResolution ? 'alertThreshold' : 'resolveThreshold';
    const otherValue = trigger[otherKey];

    // If value and/or other value is empty
    // then there are no checks to perform against
    if (otherValue === '' || value === '') {
      return true;
    }

    // If this is alert threshold and not inverted, it can't be below resolve
    // If this is alert threshold and inverted, it can't be above resolve
    // If this is resolve threshold and not inverted, it can't be above resolve
    // If this is resolve threshold and inverted, it can't be below resolve
    return !!trigger.thresholdType !== isResolution
      ? value <= otherValue
      : value >= otherValue;
  };

  /**
   * Happens if the target threshold value is in valid. We do not pre-validate because
   * it's difficult to do so with our charting library, so we validate after the
   * change propagates.
   *
   * Show an error message and reset form value, as well as force a re-rendering of chart
   * with old values (so the dragged line "resets")
   */
  revertThresholdUpdate = (type: AlertRuleThreshold) => {
    const {trigger} = this.props;
    const isIncident = type === AlertRuleThreshold.INCIDENT;
    const typeDisplay = isIncident ? t('Incident boundary') : t('Resolution boundary');
    const otherTypeDisplay = !isIncident
      ? t('Incident boundary')
      : t('Resolution boundary');

    // if incident and not inverted: incident required to be >
    // if resolution and inverted: resolution required to be >
    const direction = isIncident !== !!trigger.thresholdType ? 'greater' : 'less';

    addErrorMessage(t(`${typeDisplay} must be ${direction} than ${otherTypeDisplay}`));
  };

  /**
   * Handler for threshold changes coming from slider or chart.
   * Needs to sync state with the form.
   */
  handleChangeThreshold = (type: AlertRuleThreshold, value: ThresholdControlValue) => {
    const {onChange, trigger} = this.props;

    const thresholdKey = this.getThresholdKey(type);
    const newValue =
      value.threshold === '' ? value.threshold : Math.round(value.threshold);

    onChange({
      ...trigger,
      [thresholdKey]: newValue,
      thresholdType: value.thresholdType,
    });

    if (!this.canUpdateThreshold(type, value.threshold)) {
      this.revertThresholdUpdate(type);
    }
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
          help={t('The threshold that will trigger the associated action(s)')}
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
          help={t('The threshold that will resolve an alert')}
          error={error && error.resolutionThreshold}
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
  availableActions: MetricAction[] | null;
  organization: Organization;
  currentProject: string;
  projects: Project[];
  trigger: Trigger;
  onChange: (triggerIndex: number, trigger: Trigger) => void;
};

class TriggerFormContainer extends React.Component<TriggerFormContainerProps> {
  componentDidMount() {
    const {api, organization} = this.props;

    fetchOrgMembers(api, organization.slug);
  }

  handleChangeTrigger = (trigger: Trigger) => {
    const {onChange, triggerIndex} = this.props;
    onChange(triggerIndex, trigger);
  };

  handleAddAction = (value: Action['type']) => {
    const {onChange, trigger, triggerIndex, availableActions} = this.props;
    const actionConfig =
      availableActions && availableActions.find(({type}) => type === value);
    const actions = [
      ...trigger.actions,
      {
        type: value,
        targetType:
          actionConfig &&
          actionConfig.allowedTargetTypes &&
          actionConfig.allowedTargetTypes.length > 0
            ? actionConfig.allowedTargetTypes[0]
            : null,
        targetIdentifier: '',
        ...(actionConfig && actionConfig.integrationId !== null
          ? {integration: actionConfig.integrationId}
          : {}),
      } as Action,
    ];
    onChange(triggerIndex, {...trigger, actions});
  };

  handleChangeActions = (actions: Action[]): void => {
    const {onChange, trigger, triggerIndex} = this.props;
    onChange(triggerIndex, {...trigger, actions});
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
