import {Component} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {NumberDragInput} from 'sentry/components/core/input/numberDragInput';
import {Select} from 'sentry/components/core/select';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ThresholdControlValue} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';

interface Props extends ThresholdControlValue {
  comparisonType: AlertRuleComparisonType;
  disableThresholdType: boolean;
  disabled: boolean;
  onChange: (value: ThresholdControlValue, e: React.FormEvent) => void;
  onThresholdTypeChange: (thresholdType: AlertRuleThresholdType) => void;
  placeholder: string;
  type: string;
  hideControl?: boolean;
}

type State = {
  currentValue: string | null;
};

class ThresholdControl extends Component<Props, State> {
  state: State = {
    currentValue: null,
  };

  handleThresholdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow number and partial number inputs
    if (!/^[0-9]*\.?[0-9]*$/.test(event.target.value)) {
      return;
    }

    // Empty input
    if (event.target.value === '') {
      this.setState({currentValue: null});
      this.props.onChange(
        {thresholdType: this.props.thresholdType, threshold: ''},
        event
      );
      return;
    }

    // Only call onChange if the new number is valid, and not partially typed
    // (eg writing out the decimal '5.')
    if (/\.+0*$/.test(event.target.value)) {
      this.setState({currentValue: event.target.value});
      return;
    }

    const numberValue = Number(event.target.value);
    this.setState({currentValue: null});
    this.props.onChange(
      {thresholdType: this.props.thresholdType, threshold: numberValue},
      event
    );
  };

  handleTypeChange = ({value}: any) => {
    this.props.onThresholdTypeChange(value);
  };

  render() {
    const {currentValue} = this.state;
    const {
      thresholdType,
      comparisonType,
      hideControl,
      threshold,
      placeholder,
      type,
      onChange: _,
      onThresholdTypeChange: __,
      disabled,
      disableThresholdType,
    } = this.props;

    const inputValue = currentValue ?? threshold ?? '';

    return (
      <Flex align="center" gap="md">
        <Container comparisonType={comparisonType}>
          <SelectContainer>
            <Select
              isDisabled={disabled || disableThresholdType}
              name={`${type}ThresholdType`}
              value={thresholdType}
              options={[
                {
                  value: AlertRuleThresholdType.BELOW,
                  label:
                    comparisonType === AlertRuleComparisonType.COUNT
                      ? hideControl
                        ? t('When below Critical or Warning')
                        : t('Below')
                      : hideControl
                        ? t('When lower than Critical or Warning')
                        : t('Lower than'),
                },
                {
                  value: AlertRuleThresholdType.ABOVE,
                  label:
                    comparisonType === AlertRuleComparisonType.COUNT
                      ? hideControl
                        ? t('When above Critical or Warning')
                        : t('Above')
                      : hideControl
                        ? t('When higher than Critical or Warning')
                        : t('Higher than'),
                },
              ]}
              components={disableThresholdType ? {DropdownIndicator: null} : undefined}
              styles={
                disableThresholdType
                  ? {
                      control: (provided: any) => ({
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
          {!hideControl && (
            <ThresholdContainer comparisonType={comparisonType}>
              <Flex align="center" position="relative">
                <NumberDragInput
                  min={0}
                  step={1}
                  size="md"
                  axis="y"
                  name={`${type}Threshold`}
                  data-test-id={`${type}-threshold`}
                  value={inputValue}
                  // When shift key is held down, the pointer delta is multiplied by 1, making
                  // the threshold change more granular and precise than the step size.
                  shiftKeyMultiplier={1}
                  disabled={disabled}
                  placeholder={placeholder}
                  onChange={this.handleThresholdChange}
                  // Disable lastpass autocomplete
                  data-lpignore="true"
                />
              </Flex>
              {comparisonType === AlertRuleComparisonType.CHANGE && (
                <PercentWrapper>%</PercentWrapper>
              )}
            </ThresholdContainer>
          )}
        </Container>
      </Flex>
    );
  }
}

const Container = styled('div')<{comparisonType: AlertRuleComparisonType}>`
  flex: 2;
  display: flex;
  align-items: center;
  flex-direction: ${p =>
    p.comparisonType === AlertRuleComparisonType.COUNT ? 'row' : 'row-reverse'};
  gap: ${space(1)};
`;

const SelectContainer = styled('div')`
  flex: 1;
`;

const ThresholdContainer = styled('div')<{comparisonType: AlertRuleComparisonType}>`
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const PercentWrapper = styled('div')`
  margin-left: ${space(1)};
`;

export default ThresholdControl;
