import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {DATA_SOURCE_LABELS} from 'app/views/alerts/utils';
import {Environment, Organization} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {getDisplayName} from 'app/utils/environment';
import {t, tct} from 'app/locale';
import FormField from 'app/views/settings/components/forms/formField';
import SearchBar from 'app/views/events/searchBar';
import FieldLabel from 'app/views/settings/components/forms/field/fieldLabel';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import SelectField from 'app/views/settings/components/forms/selectField';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import Tooltip from 'app/components/tooltip';
import Feature from 'app/components/acl/feature';

import {TimeWindow, IncidentRule, Dataset} from './types';
import MetricField from './metricField';
import {DATASET_EVENT_TYPE_FILTERS, DEFAULT_AGGREGATE} from './constants';

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
  thresholdChart: React.ReactNode;
  onFilterSearch: (query: string) => void;
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
    const {organization, disabled, onFilterSearch} = this.props;
    const {environments} = this.state;

    const environmentList: [IncidentRule['environment'], React.ReactNode][] = defined(
      environments
    )
      ? environments.map((env: Environment) => [env.name, getDisplayName(env)])
      : [];

    const anyEnvironmentLabel = (
      <React.Fragment>
        {t('All Environments')}
        <div className="all-environment-note">
          {tct(
            `This will count events across every environment. For example,
             having 50 [code1:production] events and 50 [code2:development]
             events would trigger an alert with a critical threshold of 100.`,
            {code1: <code />, code2: <code />}
          )}
        </div>
      </React.Fragment>
    );
    environmentList.unshift([null, anyEnvironmentLabel]);

    return (
      <React.Fragment>
        <Feature requireAll features={['organizations:performance-view']}>
          <StyledPanel>
            <PanelHeader>{t('Alert Conditions')}</PanelHeader>
            <PanelBody>
              <FormField required name="dataset" label="Data source">
                {({onChange, onBlur, value, model, label}) => (
                  <RadioGroup
                    orientInline
                    disabled={disabled}
                    value={value}
                    label={label}
                    onChange={(id, e) => {
                      onChange(id, e);
                      onBlur(id, e);
                      // Reset the aggregate to the default (which works across
                      // datatypes), otherwise we may send snuba an invalid query
                      // (transaction aggregate on events datasource = bad).
                      model.setValue('aggregate', DEFAULT_AGGREGATE);
                    }}
                    choices={[
                      [Dataset.ERRORS, DATA_SOURCE_LABELS[Dataset.ERRORS]],
                      [Dataset.TRANSACTIONS, DATA_SOURCE_LABELS[Dataset.TRANSACTIONS]],
                    ]}
                  />
                )}
              </FormField>
            </PanelBody>
          </StyledPanel>
        </Feature>

        <div>
          {/* Contained in the same div for the css sticky overlay */}
          {this.props.thresholdChart}
          <StyledPanel>
            <PanelHeader>{t('Alert Conditions')}</PanelHeader>
            <PanelBody>
              <FormField name="query" inline={false}>
                {({onChange, onBlur, onKeyDown, initialData, model}) => (
                  <SearchContainer>
                    <SearchLabel>{t('Filter')}</SearchLabel>
                    <StyledSearchBar
                      defaultQuery={initialData?.query ?? ''}
                      inlineLabel={
                        <Tooltip
                          title={t(
                            'Metric alerts are automatically filtered to your data source'
                          )}
                        >
                          <SearchEventTypeNote>
                            {DATASET_EVENT_TYPE_FILTERS[model.getValue('dataset')]}
                          </SearchEventTypeNote>
                        </Tooltip>
                      }
                      omitTags={['event.type']}
                      disabled={disabled}
                      useFormWrapper={false}
                      organization={organization}
                      onChange={onChange}
                      onKeyDown={e => {
                        /**
                         * Do not allow enter key to submit the alerts form since it is unlikely
                         * users will be ready to create the rule as this sits above required fields.
                         */
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                        }

                        onKeyDown?.(e);
                      }}
                      onBlur={query => {
                        onFilterSearch(query);
                        onBlur(query);
                      }}
                      onSearch={query => {
                        onFilterSearch(query);
                        onChange(query, {});
                      }}
                    />
                  </SearchContainer>
                )}
              </FormField>
              <MetricField
                name="aggregate"
                label={t('Metric')}
                organization={organization}
                disabled={disabled}
                required
              />
              <SelectField
                name="timeWindow"
                label={t('Time Window')}
                help={
                  <React.Fragment>
                    <div>{t('The time window over which the Metric is evaluated')}</div>
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
              <SelectField
                name="environment"
                label={t('Environment')}
                placeholder={t('All Environments')}
                help={t('Choose which environment events must match')}
                styles={{
                  singleValue: (base: any) => ({
                    ...base,
                    '.all-environment-note': {display: 'none'},
                  }),
                  option: (base: any, state: any) => ({
                    ...base,
                    '.all-environment-note': {
                      ...(!state.isSelected && !state.isFocused
                        ? {color: theme.gray600}
                        : {}),
                      fontSize: theme.fontSizeSmall,
                    },
                  }),
                }}
                choices={environmentList}
                isDisabled={disabled || this.state.environments === null}
                isClearable
              />
            </PanelBody>
          </StyledPanel>
        </div>
      </React.Fragment>
    );
  }
}

const StyledPanel = styled(Panel)`
  /* Sticky graph panel cannot have margin-bottom */
  margin-top: ${space(2)};
`;

const SearchContainer = styled('div')`
  display: flex;
`;

const SearchLabel = styled(FieldLabel)`
  align-items: center;
  margin-right: ${space(1)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const SearchEventTypeNote = styled('div')`
  font: ${p => p.theme.fontSizeExtraSmall} ${p => p.theme.text.familyMono};
  color: ${p => p.theme.gray600};
  background: ${p => p.theme.gray200};
  border-radius: 2px;
  padding: ${space(0.5)} ${space(0.75)};
  margin: 0 ${space(0.5)} 0 ${space(1)};
  user-select: none;
`;

export default RuleConditionsForm;
