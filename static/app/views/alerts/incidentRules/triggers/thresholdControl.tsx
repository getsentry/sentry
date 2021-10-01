import * as React from 'react';
import styled from '@emotion/styled';

import SelectControl from 'app/components/forms/selectControl';
import NumberDragControl from 'app/components/numberDragControl';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  ThresholdControlValue,
} from 'app/views/alerts/incidentRules/types';
import Input from 'app/views/settings/components/forms/controls/input';

type Props = ThresholdControlValue & {
  type: string;
  disabled: boolean;
  disableThresholdType: boolean;
  placeholder: string;
  comparisonDelta?: number;
  comparisonType: AlertRuleComparisonType;
  onChange: (value: ThresholdControlValue, e: React.FormEvent) => void;
  onThresholdTypeChange: (thresholdType: AlertRuleThresholdType) => void;
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

    const {onChange, thresholdType} = this.props;

    // Empty input
    if (value === '') {
      this.setState({currentValue: null});
      onChange({thresholdType, threshold: ''}, e);
      return;
    }

    // Only call onChange if the new number is valid, and not partially typed
    // (eg writing out the decimal '5.')
    if (/\.+0*$/.test(value)) {
      this.setState({currentValue: value});
      return;
    }

    const numberValue = Number(value);

    this.setState({currentValue: null});
    onChange({thresholdType, threshold: numberValue}, e);
  };

  /**
   * Coerce the currentValue to a number and trigger the onChange.
   */
  handleThresholdBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (this.state.currentValue === null) {
      return;
    }

    const {onChange, thresholdType} = this.props;
    onChange({thresholdType, threshold: Number(this.state.currentValue)}, e);
    this.setState({currentValue: null});
  };

  handleTypeChange = ({value}) => {
    const {onThresholdTypeChange} = this.props;
    onThresholdTypeChange(value);
  };

  handleDragChange = (delta: number, e: React.MouseEvent) => {
    const {onChange, thresholdType, threshold} = this.props;
    const currentValue = threshold || 0;
    onChange({thresholdType, threshold: currentValue + delta}, e);
  };

  render() {
    const {currentValue} = this.state;
    const {
      thresholdType,
      comparisonDelta,
      comparisonType,
      threshold,
      placeholder,
      type,
      onChange: _,
      onThresholdTypeChange: __,
      disabled,
      disableThresholdType,
      ...props
    } = this.props;

    return (
      <div {...props}>
        <SelectContainer>
          <SelectControl
            isDisabled={disabled || disableThresholdType}
            name={`${type}ThresholdType`}
            value={thresholdType}
            options={[
              {value: AlertRuleThresholdType.BELOW, label: comparisonType === AlertRuleComparisonType.COUNT ? t('Below') : t('Lower by')},
              {value: AlertRuleThresholdType.ABOVE, label: comparisonType === AlertRuleComparisonType.COUNT ? t('Above') : t('Higher by')},
            ]}
            components={disableThresholdType ? {DropdownIndicator: null} : undefined}
            styles={
              disableThresholdType
                ? {
                    control: provided => ({
                      ...provided,
                      cursor: 'not-allowed',
                      pointerEvents: 'auto',
                    }),
                  }
                : undefined
            }
            onChange={this.handleTypeChange}
          />
          <ThresholdInputContainer>
          <StyledInput
            disabled={disabled}
            name={`${type}Threshold`}
            placeholder={placeholder}
            value={currentValue ?? threshold ?? ''}
            onChange={this.handleThresholdChange}
            onBlur={this.handleThresholdBlur}
            // Disable lastpass autocomplete
            data-lpignore="true"
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
          </ThresholdInputContainer>
        </SelectContainer>
        {comparisonType === AlertRuleComparisonType.CHANGE && '%'}
      </div>
    );
  }
}

const SelectContainer = styled('div')`
  flex: 1;
  display: grid;
  align-items: center;
  grid-template-columns: 2fr 5fr;
  grid-gap: ${space(1)};
  margin-right: ${space(1)};
`;

const StyledInput = styled(Input)`
  /* Match the height of the select controls */
  height: 40px;
`;

const ThresholdInputContainer = styled('div')`
  position: relative;
`;

const DragContainer = styled('div')`
  position: absolute;
  top: 4px;
  right: 12px;
`;

export default styled(ThresholdControl)`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
`;
