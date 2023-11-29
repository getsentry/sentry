import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';

import {isCrashFreeAlert} from './utils/isCrashFreeAlert';
import {AlertRuleComparisonType, Dataset} from './types';

type Props = {
  comparisonType: AlertRuleComparisonType;
  dataset: Dataset;
  disabled: boolean;
  onComparisonDeltaChange: (value: number) => void;
  onComparisonTypeChange: (value: AlertRuleComparisonType) => void;
  organization: Organization;
  comparisonDelta?: number;
};

function ThresholdTypeForm({
  organization,
  dataset,
  disabled,
  comparisonType,
  onComparisonDeltaChange,
  onComparisonTypeChange,
  comparisonDelta,
}: Props) {
  if (isCrashFreeAlert(dataset)) {
    return null;
  }

  return (
    <Feature features="organizations:change-alerts" organization={organization}>
      <FormRow>
        <StyledRadioGroup
          disabled={disabled}
          choices={[
            [AlertRuleComparisonType.COUNT, 'Static: above or below {x}'],
            [
              AlertRuleComparisonType.CHANGE,
              comparisonType === AlertRuleComparisonType.COUNT ? (
                t('Percent Change: {x%} higher or lower compared to previous period')
              ) : (
                // Prevent default to avoid dropdown menu closing on click
                <ComparisonContainer onClick={e => e.preventDefault()}>
                  {t('Percent Change: {x%} higher or lower compared to')}
                  <SelectControl
                    name="comparisonDelta"
                    styles={{
                      container: (provided: {
                        [x: string]: string | number | boolean;
                      }) => ({
                        ...provided,
                        marginLeft: space(1),
                      }),
                      control: (provided: {[x: string]: string | number | boolean}) => ({
                        ...provided,
                        minHeight: 30,
                        minWidth: 500,
                        maxWidth: 1000,
                      }),
                      valueContainer: (provided: {
                        [x: string]: string | number | boolean;
                      }) => ({
                        ...provided,
                        padding: 0,
                      }),
                      singleValue: (provided: {
                        [x: string]: string | number | boolean;
                      }) => ({
                        ...provided,
                      }),
                    }}
                    value={comparisonDelta}
                    onChange={({value}) => onComparisonDeltaChange(value)}
                    options={COMPARISON_DELTA_OPTIONS}
                    required={comparisonType === AlertRuleComparisonType.CHANGE}
                  />
                </ComparisonContainer>
              ),
            ],
          ]}
          value={comparisonType}
          label={t('Threshold Type')}
          onChange={value => onComparisonTypeChange(value as AlertRuleComparisonType)}
        />
      </FormRow>
    </Feature>
  );
}

const FormRow = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${space(2)};
`;

const ComparisonContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledRadioGroup = styled(RadioGroup)`
  flex: 1;

  gap: 0;
  & > label {
    height: 33px;
  }
`;

export default ThresholdTypeForm;
