import {PureComponent} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {
  AlertRuleSensitivity,
  type UnsavedMetricRule,
} from 'sentry/views/alerts/rules/metric/types';

type Props = {
  // aggregate: UnsavedMetricRule['aggregate'];
  // api: Client;
  // comparisonType: AlertRuleComparisonType;
  // config: Config;

  disabled: boolean;
  fieldHelp: React.ReactNode;
  // onChange: (trigger: Trigger, changeObj: Partial<Trigger>) => void;
  // onThresholdPeriodChange: (value: number) => void;
  // onThresholdTypeChange: (thresholdType: AlertRuleThresholdType) => void;
  // organization: Organization;
  // placeholder: string;
  // projects: Project[];
  // resolveThreshold: UnsavedMetricRule['resolveThreshold'];
  // thresholdPeriod: UnsavedMetricRule['thresholdPeriod'];
  // thresholdType: UnsavedMetricRule['thresholdType'];
  // trigger: Trigger;
  fieldLabel: React.ReactNode;
  sensitivity: UnsavedMetricRule['sensitivity'];
  /**
   * Map of fieldName -> errorMessage
   */
  error?: {[fieldName: string]: string};

  hideControl?: boolean;
};

class AnomalyAlertFormItem extends PureComponent<Props> {
  // Probably some stuff to handle value change that I haven't figured out yet
  render() {
    const {fieldHelp, fieldLabel, sensitivity} = this.props;

    return (
      <StyledField label={fieldLabel} help={fieldHelp} required>
        <SelectContainer>
          <SelectControl
            name="sensitivity"
            value={sensitivity}
            options={[
              {
                value: AlertRuleSensitivity.LOW,
                label: 'Low (alert less often)',
              },
              {
                value: AlertRuleSensitivity.MEDIUM,
                label: 'Medium',
              },
              {
                value: AlertRuleSensitivity.HIGH,
                label: 'High (alert more often)',
              },
            ]}
          />
        </SelectContainer>
      </StyledField>
    );
  }
}

const StyledField = styled(FieldGroup)`
  & > label > div:first-child > span {
    display: flex;
    flex-direction: row;
  }
`;

const SelectContainer = styled('div')`
  flex: 1;
`;
export default AnomalyAlertFormItem;
