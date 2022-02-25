import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

import {AlertRuleComparisonType, Dataset} from './types';

type Props = {
  comparisonType: AlertRuleComparisonType;
  dataset: Dataset;
  disabled: boolean;
  hasAlertWizardV3: boolean;
  onComparisonTypeChange: (value: AlertRuleComparisonType) => void;
  organization: Organization;
};

class ThresholdTypeForm extends PureComponent<Props> {
  render() {
    const {
      organization,
      dataset,
      disabled,
      comparisonType,
      onComparisonTypeChange,
      hasAlertWizardV3,
    } = this.props;

    return (
      <Fragment>
        {dataset !== Dataset.SESSIONS && (
          <Feature features={['organizations:change-alerts']} organization={organization}>
            {!hasAlertWizardV3 && (
              <StyledListItem>{t('Select threshold type')}</StyledListItem>
            )}
            <FormRow>
              <RadioGroup
                style={{flex: 1}}
                disabled={disabled}
                choices={[
                  [
                    AlertRuleComparisonType.COUNT,
                    hasAlertWizardV3 ? 'Static: above or below {x}' : 'Count',
                  ],
                  [
                    AlertRuleComparisonType.CHANGE,
                    hasAlertWizardV3
                      ? 'Percent Change: {x%} higher or lower compared to previous period'
                      : 'Percent Change',
                  ],
                ]}
                value={comparisonType}
                label={t('Threshold Type')}
                onChange={onComparisonTypeChange}
              />
            </FormRow>
          </Feature>
        )}
      </Fragment>
    );
  }
}

const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1.3;
`;

const FormRow = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${space(4)};
`;

export default ThresholdTypeForm;
