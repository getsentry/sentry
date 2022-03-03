import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SelectControl from 'sentry/components/forms/selectControl';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/incidentRules/constants';

import {AlertRuleComparisonType, Dataset} from './types';

type Props = {
  comparisonType: AlertRuleComparisonType;
  dataset: Dataset;
  disabled: boolean;
  hasAlertWizardV3: boolean;
  onComparisonDeltaChange: (value: number) => void;
  onComparisonTypeChange: (value: AlertRuleComparisonType) => void;
  organization: Organization;
  comparisonDelta?: number;
};

const ThresholdTypeForm = ({
  organization,
  dataset,
  disabled,
  comparisonType,
  onComparisonDeltaChange,
  onComparisonTypeChange,
  hasAlertWizardV3,
  comparisonDelta,
}: Props) =>
  dataset === Dataset.SESSIONS ? null : (
    <Feature features={['organizations:change-alerts']} organization={organization}>
      {!hasAlertWizardV3 && <StyledListItem>{t('Select threshold type')}</StyledListItem>}
      <FormRow hasAlertWizardV3={hasAlertWizardV3}>
        <StyledRadioGroup
          hasAlertWizardV3={hasAlertWizardV3}
          disabled={disabled}
          choices={[
            [
              AlertRuleComparisonType.COUNT,
              hasAlertWizardV3 ? 'Static: above or below {x}' : 'Count',
            ],
            [
              AlertRuleComparisonType.CHANGE,
              hasAlertWizardV3 ? (
                comparisonType === AlertRuleComparisonType.COUNT ? (
                  'Percent Change: {x%} higher or lower compared to previous period'
                ) : (
                  <ComparisonContainer>
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
                        control: (provided: {
                          [x: string]: string | number | boolean;
                        }) => ({
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
                      onClick={e => e.stopPropagation()}
                      onChange={({value}) => onComparisonDeltaChange(value)}
                      options={COMPARISON_DELTA_OPTIONS}
                      required={comparisonType === AlertRuleComparisonType.CHANGE}
                    />
                  </ComparisonContainer>
                )
              ) : (
                'Percent Change'
              ),
            ],
          ]}
          value={comparisonType}
          label={t('Threshold Type')}
          onChange={onComparisonTypeChange}
        />
      </FormRow>
    </Feature>
  );

const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1.3;
`;

const FormRow = styled('div')<{hasAlertWizardV3: boolean}>`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${p => (p.hasAlertWizardV3 ? space(2) : space(4))};
`;

const ComparisonContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledRadioGroup = styled(RadioGroup)<{hasAlertWizardV3: boolean}>`
  flex: 1;

  ${p => p.hasAlertWizardV3 && 'gap: 0;'}
  & > label {
    ${p => p.hasAlertWizardV3 && 'height: 33px;'}
  }
`;

export default ThresholdTypeForm;
