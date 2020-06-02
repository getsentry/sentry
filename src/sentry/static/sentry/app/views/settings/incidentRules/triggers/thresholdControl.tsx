import React from 'react';
import styled from '@emotion/styled';

import {
  ThresholdControlValue,
  AlertRuleThreshold,
  AlertRuleThresholdType,
} from 'app/views/settings/incidentRules/types';
import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';

type Props = ThresholdControlValue & {
  type: AlertRuleThreshold;
  disabled: boolean;
  onChange: (
    type: AlertRuleThreshold,
    value: ThresholdControlValue,
    e: React.FormEvent
  ) => void;
};

type State = {
  currentValue: string | null;
};

class ThresholdControl extends React.Component<Props, State> {
  state: State = {
    currentValue: null,
  };

  handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {value} = e.target;

    // Only allow number and partial number inputs
    if (!/^[0-9]*\.?[0-9]*$/.test(value)) {
      return;
    }

    const {onChange, type, thresholdType} = this.props;

    // Empty input
    if (value === '') {
      this.setState({currentValue: null});
      onChange(type, {thresholdType, threshold: ''}, e);
      return;
    }

    // Only call onChnage if the new number is valid, and not partially typed
    // (eg writing out the decimal '5.')
    if (/(\.|0)$/.test(value)) {
      this.setState({currentValue: value});
      return;
    }

    const numberValue = Number(value);

    this.setState({currentValue: null});
    onChange(type, {thresholdType, threshold: numberValue}, e);
  };

  /**
   * Coerce the currentValue to a number and trigger the onChange.
   */
  handleThresholdBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (this.state.currentValue === null) {
      return;
    }

    const {onChange, type, thresholdType} = this.props;
    onChange(type, {thresholdType, threshold: Number(this.state.currentValue)}, e);
    this.setState({currentValue: null});
  };

  handleTypeChange = ({value}, e) => {
    const {onChange, type, threshold} = this.props;

    onChange(
      type,
      {thresholdType: getThresholdTypeForThreshold(type, value), threshold},
      e
    );
  };

  render() {
    const {currentValue} = this.state;
    const {thresholdType, threshold, type, onChange: _, disabled, ...props} = this.props;
    const thresholdName = AlertRuleThreshold.INCIDENT === type ? 'alert' : 'resolve';

    return (
      <div {...props}>
        <SelectControl
          isDisabled={disabled}
          name={`${thresholdName}ThresholdType`}
          value={getThresholdTypeForThreshold(type, thresholdType)}
          options={[
            {value: AlertRuleThresholdType.BELOW, label: t('Below')},
            {value: AlertRuleThresholdType.ABOVE, label: t('Above')},
          ]}
          onChange={this.handleTypeChange}
        />
        <Input
          disabled={disabled}
          name={`${thresholdName}Threshold`}
          placeholder="300"
          value={currentValue ?? threshold ?? ''}
          onChange={this.handleThresholdChange}
          onBlur={this.handleThresholdBlur}
        />
      </div>
    );
  }
}

export default styled(ThresholdControl)`
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 3fr;
  grid-gap: ${space(1)};
`;

function getThresholdTypeForThreshold(
  type: AlertRuleThreshold,
  thresholdType: AlertRuleThresholdType
): AlertRuleThresholdType {
  return (type === AlertRuleThreshold.INCIDENT) !==
    (thresholdType === AlertRuleThresholdType.ABOVE)
    ? AlertRuleThresholdType.BELOW
    : AlertRuleThresholdType.ABOVE;
}
