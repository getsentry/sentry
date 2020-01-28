import React from 'react';

import {Client} from 'app/api';
import {Environment, Organization} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import FormField from 'app/views/settings/components/forms/formField';
import SearchBar from 'app/views/events/searchBar';
import SelectField from 'app/views/settings/components/forms/selectField';

import {AlertRuleAggregations, TimeWindow} from './types';
import getMetricDisplayName from './utils/getMetricDisplayName';

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

type Props = {
  api: Client;
  organization: Organization;
  projectSlug: string;
  disabled: boolean;
};

type State = {
  environments: Environment[] | null;
};

class RuleConditionsForm extends React.PureComponent<Props, State> {
  state: State = {
    environments: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {api, organization, projectSlug} = this.props;

    try {
      const environments = await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/environments/`,
        {
          query: {
            visibility: 'visible',
          },
        }
      );
      this.setState({environments});
    } catch (_err) {
      addErrorMessage(t('Unable to fetch environments'));
    }
  }

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
          <SelectField
            name="environment"
            label={t('Environment')}
            help={t('Select an environment')}
            placeholder={t('All environments')}
            choices={
              defined(this.state.environments)
                ? this.state.environments.map((env: Environment) => [env.id, env.name])
                : []
            }
            disabled={this.state.environments === null}
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
