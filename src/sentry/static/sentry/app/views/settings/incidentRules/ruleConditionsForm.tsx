import React from 'react';

import {Organization} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import FormField from 'app/views/settings/components/forms/formField';
import SearchBar from 'app/views/events/searchBar';
import SelectField from 'app/views/settings/components/forms/selectField';

import {AlertRuleAggregations, TimeWindow} from './types';
import getMetricDisplayName from './utils/getMetricDisplayName';

type Props = {
  organization: Organization;
  disabled: boolean;
};

type TimeWindowMapType = {[key in TimeWindow]: string};

const TIME_WINDOW_MAP: TimeWindowMapType = {
  [TimeWindow.ONE_MINUTE]: t('1 minute'),
  [TimeWindow.FIVE_MINUTES]: t('5 minutes'),
  [TimeWindow.TEN_MINUTES]: t('10 minutes'),
  [TimeWindow.FIFTEEN_MINUTES]: t('15 minutes'),
  [TimeWindow.THIRTY_MINUTES]: t('30 minutes'),
  [TimeWindow.ONE_HOUR]: t('1 hour'),
  [TimeWindow.TWO_HOURS]: t('2 hours'),
  [TimeWindow.FOUR_HOURS]: t('4 hours'),
  [TimeWindow.ONE_DAY]: t('24 hours'),
};

class RuleConditionsForm extends React.PureComponent<Props> {
  render() {
    const {organization, disabled} = this.props;

    return (
      <Panel>
        <PanelHeader>{t('Configure Rule Conditions')}</PanelHeader>
        <PanelBody>
          <SelectField
            name="aggregation"
            label={t('Metric')}
            help={t('Choose which metric to trigger on')}
            choices={[
              [
                AlertRuleAggregations.UNIQUE_USERS,
                getMetricDisplayName(AlertRuleAggregations.UNIQUE_USERS),
              ],
              [
                AlertRuleAggregations.TOTAL,
                getMetricDisplayName(AlertRuleAggregations.TOTAL),
              ],
            ]}
            required
            disabled={disabled}
          />
          <FormField
            name="query"
            label={t('Filter')}
            defaultValue=""
            placeholder="error.type:TypeError"
            help={t(
              'You can apply standard Sentry filter syntax to filter by status, user, etc.'
            )}
          >
            {({onChange, onBlur, onKeyDown}) => {
              return (
                <SearchBar
                  disabled={disabled}
                  useFormWrapper={false}
                  organization={organization}
                  onChange={onChange}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                  onSearch={query => onChange(query, {})}
                />
              );
            }}
          </FormField>
          <SelectField
            name="timeWindow"
            label={t('Time Window')}
            help={t('The time window to use when evaluating the Metric')}
            choices={Object.entries(TIME_WINDOW_MAP)}
            required
            disabled={disabled}
          />
        </PanelBody>
      </Panel>
    );
  }
}

export default RuleConditionsForm;
