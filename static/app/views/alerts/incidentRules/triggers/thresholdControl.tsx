import * as React from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/selectControl';
import NumberDragControl from 'sentry/components/numberDragControl';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  ThresholdControlValue,
} from 'sentry/views/alerts/incidentRules/types';
import Input from 'sentry/views/settings/components/forms/controls/input';

type Props = ThresholdControlValue & {
  type: string;
  disabled: boolean;
  disableThresholdType: boolean;
  placeholder: string;
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
        <Container comparisonType={comparisonType}>
          <SelectContainer>
            <SelectControl
              isDisabled={disabled || disableThresholdType}
              name={`${type}ThresholdType`}
              value={thresholdType}
              options={[
                {
                  value: AlertRuleThresholdType.BELOW,
                  label:
                    comparisonType === AlertRuleComparisonType.COUNT
                      ? t('Below')
                      : t('Lower than'),
                },
                {
                  value: AlertRuleThresholdType.ABOVE,
                  label:
                    comparisonType === AlertRuleComparisonType.COUNT
                      ? t('Above')
                      : t('Higher than'),
                },
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
          </SelectContainer>
          <ThresholdContainer comparisonType={comparisonType}>
            <ThresholdInput>
              <StyledInput
                disabled={disabled}
                name={`${type}Threshold`}
                data-test-id={`${type}-threshold`}
                placeholder={placeholder}
                value={currentValue ?? threshold ?? ''}
                onChange={this.handleThresholdChange}
                onBlur={this.handleThresholdBlur}
                // Disable lastpass autocomplete
                data-lpignore="true"
              />
              <DragContainer>
                <Tooltip
                  title={tct(
                    'Drag to adjust threshold[break]You can hold shift to fine tune',
                    {
                      break: <br />,
                    }
                  )}
                >
                  <NumberDragControl step={5} axis="y" onChange={this.handleDragChange} />
                </Tooltip>
              </DragContainer>
            </ThresholdInput>
            {comparisonType === AlertRuleComparisonType.CHANGE && '%'}
          </ThresholdContainer>
        </Container>
      </div>
    );
  }
}

const Container = styled('div')<{comparisonType: AlertRuleComparisonType}>`
  flex: 1;
  display: flex;
  align-items: center;
  flex-direction: ${p =>
    p.comparisonType === AlertRuleComparisonType.COUNT ? 'row' : 'row-reverse'};
  gap: ${p => (p.comparisonType === AlertRuleComparisonType.COUNT ? space(1) : space(2))};
`;

const SelectContainer = styled('div')`
  flex: 1;
`;

const ThresholdContainer = styled('div')<{comparisonType: AlertRuleComparisonType}>`
  flex: ${p => (p.comparisonType === AlertRuleComparisonType.COUNT ? '3' : '2')};
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledInput = styled(Input)`
  /* Match the height of the select controls */
  height: 40px;
`;

const ThresholdInput = styled('div')`
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-right: ${space(1)};
`;

const DragContainer = styled('div')`
  position: absolute;
  top: 4px;
  right: 12px;
`;

export default styled(ThresholdControl)`
  display: flex;
  flex-direction: row;
  align-items: center;
`;
