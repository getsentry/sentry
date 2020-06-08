import React from 'react';
import styled from '@emotion/styled';

import {
  ThresholdControlValue,
  AlertRuleThreshold,
  AlertRuleThresholdType,
} from 'app/views/settings/incidentRules/types';
import {t, tct} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';
import NumberDragControl from 'app/components/numberDragControl';
import Tooltip from 'app/components/tooltip';

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

  handleDragChange = (delta: number, e: React.MouseEvent) => {
    const {onChange, type, thresholdType, threshold} = this.props;
    const currentValue = threshold || 0;
    onChange(type, {thresholdType, threshold: currentValue + delta}, e);
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
        <DragContainer>
          <Tooltip
            title={tct('Drag to adjust threshold[break]You can hold shift to fine tune', {
              break: <br />,
            })}
          >
            <NumberDragControl step={5} axis="y" onChange={this.handleDragChange} />
          </Tooltip>
        </DragContainer>
      </div>
    );
  }
}

const DragContainer = styled('div')`
  position: absolute;
  top: 6px;
  right: 12px;
`;

export default styled(ThresholdControl)`
  position: relative;
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
