import {debounce} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {Config, Organization, Project} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';

import TriggersChart from './chart';

import {
  AlertRuleThreshold,
  AlertRuleThresholdType,
  IncidentRule,
  Trigger,
} from '../types';

type AlertRuleThresholdKey = {
  [AlertRuleThreshold.INCIDENT]: 'alertThreshold';
  [AlertRuleThreshold.RESOLUTION]: 'resolveThreshold';
};

type Props = {
  api: Client;
  config: Config;
  organization: Organization;
  projects: Project[];
  rule: IncidentRule;
  trigger?: Trigger;
};

type State = {
  width?: number;
  isInverted: boolean;
  alertThreshold: number | null;
  resolveThreshold: number | null;
  maxThreshold: number | null;
};

class TriggerForm extends React.Component<Props, State> {
  static contextTypes = {
    form: PropTypes.any,
  };

  static defaultProps = {};

  state = {
    isInverted: this.props.trigger
      ? this.props.trigger.thresholdType === AlertRuleThresholdType.BELOW
      : false,
    alertThreshold: this.props.trigger ? this.props.trigger.alertThreshold : null,
    resolveThreshold: this.props.trigger ? this.props.trigger.resolveThreshold : null,
    maxThreshold: this.props.trigger
      ? Math.max(
          this.props.trigger.alertThreshold,
          this.props.trigger.resolveThreshold
        ) || null
      : null,
  };

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
  canUpdateThreshold = (type: AlertRuleThreshold, value: number): boolean => {
    const isResolution = type === AlertRuleThreshold.RESOLUTION;
    const otherKey = isResolution ? 'alertThreshold' : 'resolveThreshold';
    const otherValue = this.state[otherKey];

    // If other value is `null`, then there are no checks to perform against
    if (otherValue === null) {
      return true;
    }

    // If this is alert threshold and not inverted, it can't be below resolve
    // If this is alert threshold and inverted, it can't be above resolve
    // If this is resolve threshold and not inverted, it can't be above resolve
    // If this is resolve threshold and inverted, it can't be below resolve
    return !!this.state.isInverted !== isResolution
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
    const isIncident = type === AlertRuleThreshold.INCIDENT;
    const typeDisplay = isIncident ? t('Incident boundary') : t('Resolution boundary');
    const otherTypeDisplay = !isIncident
      ? t('Incident boundary')
      : t('Resolution boundary');

    // if incident and not inverted: incident required to be >
    // if resolution and inverted: resolution required to be >
    const direction = isIncident !== this.state.isInverted ? 'greater' : 'less';

    addErrorMessage(t(`${typeDisplay} must be ${direction} than ${otherTypeDisplay}`));

    // Need to a re-render so that our chart re-renders and moves the draggable line back
    // to its original position (since the drag update is not valid)
    this.forceUpdate();

    // Reset form value
    const thresholdKey = this.getThresholdKey(type);
    this.context.form.setValue(thresholdKey, this.state[thresholdKey]);
  };

  /**
   * Handler for the range slider input. Needs to update state (as well as max threshold)
   */
  updateThresholdInput = (type: AlertRuleThreshold, value: number) => {
    if (this.canUpdateThreshold(type, value)) {
      this.setState(state => ({
        ...state,
        [this.getThresholdKey(type)]: value,
        ...(value > (state.maxThreshold || 0) && {maxThreshold: value}),
      }));
    } else {
      this.revertThresholdUpdate(type);
    }
  };

  /**
   * Handler for threshold changes coming from slider or chart.
   * Needs to sync state with the form.
   */
  updateThreshold = (type: AlertRuleThreshold, value: number) => {
    if (this.canUpdateThreshold(type, value)) {
      const thresholdKey = this.getThresholdKey(type);
      const newValue = Math.round(value);
      this.setState(state => ({
        ...state,
        [thresholdKey]: newValue,
        ...(newValue > (state.maxThreshold || 0) && {maxThreshold: newValue}),
      }));
      this.context.form.setValue(thresholdKey, Math.round(newValue));
    } else {
      this.revertThresholdUpdate(type);
    }
  };

  handleChangeIncidentThresholdInput = debounce((value: number) => {
    this.updateThresholdInput(AlertRuleThreshold.INCIDENT, value);
  }, 50);

  handleChangeIncidentThreshold = (value: number) => {
    this.updateThreshold(AlertRuleThreshold.INCIDENT, value);
  };

  handleChangeResolutionThresholdInput = debounce((value: number) => {
    this.updateThresholdInput(AlertRuleThreshold.RESOLUTION, value);
  }, 50);

  handleChangeResolutionThreshold = (value: number) => {
    this.updateThreshold(AlertRuleThreshold.RESOLUTION, value);
  };

  /**
   * Changes the threshold type (i.e. if thresholds are inverted or not)
   */
  handleChangeThresholdType = (value: boolean) => {
    // Swap values and toggle `state.isInverted`, so they if invert it twice, they get their original values
    this.setState(state => {
      const oldValues = {
        resolve: state.resolveThreshold,
        alert: state.alertThreshold,
      };

      this.context.form.setValue('resolveThreshold', oldValues.alert);
      this.context.form.setValue('alertThreshold', oldValues.resolve);
      return {
        isInverted: value,
        resolveThreshold: oldValues.alert,
        alertThreshold: oldValues.resolve,
      };
    });
  };

  render() {
    const {api, config, organization, projects, rule} = this.props;
    const {alertThreshold, resolveThreshold, isInverted} = this.state;

    return (
      <React.Fragment>
        <JsonForm
          renderHeader={() => (
            <TriggersChart
              api={api}
              config={config}
              organization={organization}
              projects={projects}
              rule={rule}
              isInverted={isInverted}
              alertThreshold={alertThreshold}
              resolveThreshold={resolveThreshold}
              timeWindow={rule.timeWindow}
              onChangeIncidentThreshold={this.handleChangeIncidentThreshold}
              onChangeResolutionThreshold={this.handleChangeResolutionThreshold}
            />
          )}
          fields={[
            {
              name: 'label',
              type: 'text',
              label: t('Label'),
              help: t('This will prefix alerts created by this trigger'),
              placeholder: t('SEV-0'),
              required: true,
            },
            {
              name: 'alertThreshold',
              type: 'range',
              label: t('Incident Boundary'),
              help: !isInverted
                ? t('Anything trending above this limit will trigger an Incident')
                : t('Anything trending below this limit will trigger an Incident'),
              onChange: this.handleChangeIncidentThresholdInput,
              showCustomInput: true,
              required: true,
              min: 1,
            },
            {
              name: 'resolveThreshold',
              type: 'range',
              label: t('Resolution Boundary'),
              help: !isInverted
                ? t('Anything trending below this limit will resolve an Incident')
                : t('Anything trending above this limit will resolve an Incident'),
              onChange: this.handleChangeResolutionThresholdInput,
              showCustomInput: true,
              placeholder: resolveThreshold === null ? t('Off') : '',
              min: 1,
            },
            {
              name: 'thresholdType',
              type: 'boolean',
              label: t('Reverse the Boundaries'),
              defaultValue: AlertRuleThresholdType.ABOVE,
              help: t('This is a metric that needs to stay above a certain threshold'),
              onChange: this.handleChangeThresholdType,
            },
          ]}
        />
      </React.Fragment>
    );
  }
}

type TriggerFormContainerProps = {
  orgId: string;
  onSubmitSuccess?: Function;
} & React.ComponentProps<typeof TriggerForm>;

function TriggerFormContainer({
  orgId,
  onSubmitSuccess,
  rule,
  trigger,
  ...props
}: TriggerFormContainerProps) {
  return (
    <Form
      apiMethod={trigger ? 'PUT' : 'POST'}
      apiEndpoint={`/organizations/${orgId}/alert-rules/${rule.id}/triggers/${
        trigger ? `${trigger.id}/` : ''
      }`}
      initialData={{
        thresholdType: AlertRuleThresholdType.ABOVE,
        ...trigger,
      }}
      saveOnBlur={false}
      onSubmitSuccess={onSubmitSuccess}
      submitLabel={trigger ? t('Update Trigger') : t('Create Trigger')}
    >
      <TriggerForm rule={rule} trigger={trigger} {...props} />
    </Form>
  );
}

export default withConfig(withApi(TriggerFormContainer));
