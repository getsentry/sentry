import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {DATA_SOURCE_LABELS} from 'app/views/alerts/utils';
import {Environment, Organization} from 'app/types';
import {Panel, PanelBody} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {getDisplayName} from 'app/utils/environment';
import {t, tct} from 'app/locale';
import FormField from 'app/views/settings/components/forms/formField';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import SearchBar from 'app/views/events/searchBar';
import SelectField from 'app/views/settings/components/forms/selectField';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import Tooltip from 'app/components/tooltip';
import Feature from 'app/components/acl/feature';

import {TimeWindow, IncidentRule, Dataset} from './types';
import MetricField from './metricField';
import {DATASET_EVENT_TYPE_FILTERS, DEFAULT_AGGREGATE} from './constants';

const TIME_WINDOW_MAP: Record<TimeWindow, string> = {
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
  thresholdChart: React.ReactElement;
  onFilterSearch: (query: string) => void;
};

type State = {
  environments: Environment[] | null;
};

class RuleConditionsFormWithGuiFilters extends React.PureComponent<Props, State> {
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

    const environmentList: [IncidentRule['environment'], React.ReactNode][] =
      environments?.map((env: Environment) => [env.name, getDisplayName(env)]) ?? [];

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

    const formElemBaseStyle = {
      padding: `${space(0.5)}`,
      border: 'none',
    };

    const selectLabel = (label: string) => ({
      ':before': {
        content: `"${label}"`,
        color: theme.gray500,
        fontWeight: 600,
      },
    });

    return (
      <StyledPanel>
        <PanelBody>
          <List symbol="colored-numeric">
            <StyledListItem>{t('Select the events you want to alert on')}</StyledListItem>
            <FormRow>
              <SelectField
                name="environment"
                placeholder={t('All Environments')}
                style={{
                  ...formElemBaseStyle,
                  minWidth: 250,
                  flex: 2,
                }}
                styles={{
                  singleValue: (base: any) => ({
                    ...base,
                    ...selectLabel(t('Env: ')),
                    '.all-environment-note': {display: 'none'},
                  }),
                  placeholder: (base: any) => ({
                    ...base,
                    ...selectLabel(t('Env: ')),
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
                inline={false}
                flexibleControlStateSize
              />
              <Feature requireAll features={['organizations:performance-view']}>
                <FormField
                  name="dataset"
                  inline={false}
                  style={{
                    ...formElemBaseStyle,
                    minWidth: 250,
                    flex: 3,
                  }}
                  flexibleControlStateSize
                >
                  {({onChange, onBlur, model, value}) => (
                    <SelectControl
                      value={value}
                      // placeholder={t('Errors')}
                      styles={{
                        singleValue: (base: any) => ({
                          ...base,
                          ...selectLabel(t('Data Source: ')),
                        }),
                        placeholder: (base: any) => ({
                          ...base,
                          ...selectLabel(t('Data Source: ')),
                        }),
                      }}
                      onChange={optionObj => {
                        const optionValue = optionObj.value;
                        onChange(optionValue, {});
                        onBlur(optionValue, {});
                        // Reset the aggregate to the default (which works across
                        // datatypes), otherwise we may send snuba an invalid query
                        // (transaction aggregate on events datasource = bad).
                        model.setValue('aggregate', DEFAULT_AGGREGATE);
                      }}
                      choices={[
                        [Dataset.ERRORS, DATA_SOURCE_LABELS[Dataset.ERRORS]],
                        [Dataset.TRANSACTIONS, DATA_SOURCE_LABELS[Dataset.TRANSACTIONS]],
                      ]}
                      isDisabled={disabled}
                      required
                    />
                  )}
                </FormField>
              </Feature>
              <FormField
                name="query"
                inline={false}
                style={{
                  ...formElemBaseStyle,
                  flex: 6,
                  minWidth: 400,
                }}
                flexibleControlStateSize
              >
                {({onChange, onBlur, onKeyDown, initialData, model}) => (
                  <SearchContainer>
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
                      placeholder={
                        model.getValue('dataset') === 'events'
                          ? t('Filter events by level, message, or other properties...')
                          : t('Filter transactions by URL, tags, and other properties...')
                      }
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
            </FormRow>
            <StyledListItem>{t('Choose a metric')}</StyledListItem>
            <FormRow>
              <MetricField
                name="aggregate"
                help={null}
                organization={organization}
                disabled={disabled}
                style={{
                  ...formElemBaseStyle,
                  flex: 6,
                  minWidth: 300,
                }}
                inline={false}
                flexibleControlStateSize
                required
              />
              <FormRowText>over</FormRowText>
              <SelectField
                name="timeWindow"
                style={{
                  ...formElemBaseStyle,
                  flex: 1,
                  minWidth: 150,
                }}
                choices={Object.entries(TIME_WINDOW_MAP)}
                required
                isDisabled={disabled}
                getValue={value => Number(value)}
                setValue={value => `${value}`}
                inline={false}
                flexibleControlStateSize
              />
            </FormRow>
            {this.props.thresholdChart}
          </List>
        </PanelBody>
      </StyledPanel>
    );
  }
}

const StyledPanel = styled(Panel)`
  /* Sticky graph panel cannot have margin-bottom */
  padding: ${space(1)};
`;

const SearchContainer = styled('div')`
  display: flex;
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

const StyledListItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: ${space(2)} ${space(2)} 0 ${space(2)};
`;

const FormRow = styled('div')`
  display: flex;
  flex-direction: row;
  padding: ${space(1.5)};
  align-items: flex-end;
  flex-wrap: wrap;
`;

const FormRowText = styled('div')`
  padding: ${space(0.5)};
  line-height: 38px;
`;

export default RuleConditionsFormWithGuiFilters;
