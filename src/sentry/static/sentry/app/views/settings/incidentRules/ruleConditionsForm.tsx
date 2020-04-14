import React from 'react';

import {Client} from 'app/api';
import {Environment, Organization} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {getDisplayName} from 'app/utils/environment';
import {t, tct} from 'app/locale';
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
  onFilterUpdate: (query: string) => void;
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
    const {organization, disabled, onFilterUpdate} = this.props;

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
            isDisabled={disabled}
          />
          <SelectField
            name="environment"
            label={t('Environment')}
            help={t('Select an environment')}
            placeholder={t('All environments')}
            choices={
              defined(this.state.environments)
                ? this.state.environments.map((env: Environment) => [
                    env.name,
                    getDisplayName(env),
                  ])
                : []
            }
            isDisabled={disabled || this.state.environments === null}
            multiple
            isClearable
          />
          <FormField
            name="query"
            label={t('Filter')}
            placeholder="error.type:TypeError"
            help={tct(`Note: A filter of [filter] is automatically applied`, {
              filter: <code>event.type:error</code>,
            })}
          >
            {({onChange, onBlur, onKeyDown, initialData}) => (
              <SearchBar
                defaultQuery={initialData?.query ?? ''}
                disabled={disabled}
                useFormWrapper={false}
                organization={organization}
                onChange={onChange}
                onKeyDown={onKeyDown}
                onBlur={query => {
                  onFilterUpdate(query);
                  onBlur(query);
                }}
                onSearch={query => {
                  onFilterUpdate(query);
                  onChange(query, {});
                }}
              />
            )}
          </FormField>
          <SelectField
            name="timeWindow"
            label={t('Time Window')}
            help={
              <React.Fragment>
                <div>{t('The time window to use when evaluating the Metric')}</div>
                <div>
                  {t(
                    'Note: Triggers are evaluated every minute regardless of this value.'
                  )}
                </div>
              </React.Fragment>
            }
            choices={Object.entries(TIME_WINDOW_MAP)}
            required
            isDisabled={disabled}
            getValue={value => Number(value)}
            setValue={value => `${value}`}
          />
        </PanelBody>
      </Panel>
    );
  }
}

export default RuleConditionsForm;
