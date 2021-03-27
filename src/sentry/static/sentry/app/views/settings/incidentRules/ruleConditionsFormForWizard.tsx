import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import SearchBar from 'app/components/events/searchBar';
import SelectControl from 'app/components/forms/selectControl';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {Panel, PanelBody} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Environment, Organization, SelectValue} from 'app/types';
import {getDisplayName} from 'app/utils/environment';
import theme from 'app/utils/theme';
import {
  convertDatasetEventTypesToSource,
  DATA_SOURCE_LABELS,
  DATA_SOURCE_TO_SET_AND_EVENT_TYPES,
} from 'app/views/alerts/utils';
import FormField from 'app/views/settings/components/forms/formField';
import SelectField from 'app/views/settings/components/forms/selectField';

import {DEFAULT_AGGREGATE, DEFAULT_TRANSACTION_AGGREGATE} from './constants';
import MetricField from './metricField';
import {Datasource, TimeWindow} from './types';

const TIME_WINDOW_MAP: Record<TimeWindow, string> = {
  [TimeWindow.ONE_MINUTE]: t('1 minute window'),
  [TimeWindow.FIVE_MINUTES]: t('5 minute window'),
  [TimeWindow.TEN_MINUTES]: t('10 minute window'),
  [TimeWindow.FIFTEEN_MINUTES]: t('15 minute window'),
  [TimeWindow.THIRTY_MINUTES]: t('30 minute window'),
  [TimeWindow.ONE_HOUR]: t('1 hour window'),
  [TimeWindow.TWO_HOURS]: t('2 hour window'),
  [TimeWindow.FOUR_HOURS]: t('4 hour window'),
  [TimeWindow.ONE_DAY]: t('24 hour window'),
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

class RuleConditionsFormForWizard extends React.PureComponent<Props, State> {
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

    const environmentOptions: SelectValue<string | null>[] =
      environments?.map((env: Environment) => ({
        value: env.name,
        label: getDisplayName(env),
      })) ?? [];

    const anyEnvironmentLabel = (
      <React.Fragment>
        {t('All')}
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
    environmentOptions.unshift({value: null, label: anyEnvironmentLabel});

    const dataSourceOptions = [
      {
        label: t('Errors'),
        options: [
          {
            value: Datasource.ERROR_DEFAULT,
            label: DATA_SOURCE_LABELS[Datasource.ERROR_DEFAULT],
          },
          {
            value: Datasource.DEFAULT,
            label: DATA_SOURCE_LABELS[Datasource.DEFAULT],
          },
          {
            value: Datasource.ERROR,
            label: DATA_SOURCE_LABELS[Datasource.ERROR],
          },
        ],
      },
    ];

    if (organization.features.includes('performance-view')) {
      dataSourceOptions.push({
        label: t('Transactions'),
        options: [
          {
            value: Datasource.TRANSACTION,
            label: DATA_SOURCE_LABELS[Datasource.TRANSACTION],
          },
        ],
      });
    }

    const formElemBaseStyle = {
      padding: `${space(0.5)}`,
      border: 'none',
    };

    return (
      <Panel>
        <StyledPanelBody>
          <StyledList symbol="colored-numeric">
            <ListItem>{t('Select events')}</ListItem>
            <FormRow>
              <SelectField
                name="environment"
                placeholder={t('All')}
                style={{
                  ...formElemBaseStyle,
                  minWidth: 250,
                  flex: 1,
                }}
                styles={{
                  singleValue: (base: any) => ({
                    ...base,
                    '.all-environment-note': {display: 'none'},
                  }),
                  option: (base: any, state: any) => ({
                    ...base,
                    '.all-environment-note': {
                      ...(!state.isSelected && !state.isFocused
                        ? {color: theme.gray400}
                        : {}),
                      fontSize: theme.fontSizeSmall,
                    },
                  }),
                }}
                options={environmentOptions}
                isDisabled={disabled || this.state.environments === null}
                isClearable
                inline={false}
                flexibleControlStateSize
                inFieldLabel={t('Environment: ')}
              />
              <FormField
                name="datasource"
                inline={false}
                style={{
                  ...formElemBaseStyle,
                  minWidth: 300,
                  flex: 2,
                }}
                flexibleControlStateSize
              >
                {({onChange, onBlur, model}) => {
                  const formDataset = model.getValue('dataset');
                  const formEventTypes = model.getValue('eventTypes');
                  const mappedValue = convertDatasetEventTypesToSource(
                    formDataset,
                    formEventTypes
                  );
                  return (
                    <SelectControl
                      value={mappedValue}
                      inFieldLabel={t('Data Source: ')}
                      onChange={optionObj => {
                        const optionValue = optionObj.value;
                        onChange(optionValue, {});
                        onBlur(optionValue, {});
                        // Reset the aggregate to the default (which works across
                        // datatypes), otherwise we may send snuba an invalid query
                        // (transaction aggregate on events datasource = bad).
                        optionValue === 'transaction'
                          ? model.setValue('aggregate', DEFAULT_TRANSACTION_AGGREGATE)
                          : model.setValue('aggregate', DEFAULT_AGGREGATE);

                        // set the value of the dataset and event type from data source
                        const {dataset, eventTypes} =
                          DATA_SOURCE_TO_SET_AND_EVENT_TYPES[optionValue] ?? {};
                        model.setValue('dataset', dataset);
                        model.setValue('eventTypes', eventTypes);
                      }}
                      options={dataSourceOptions}
                      isDisabled={disabled}
                      required
                    />
                  );
                }}
              </FormField>
              <FormField
                name="query"
                inline={false}
                style={{
                  ...formElemBaseStyle,
                  flex: '6 0 700px',
                }}
                flexibleControlStateSize
              >
                {({onChange, onBlur, onKeyDown, initialData, model}) => (
                  <SearchContainer>
                    <StyledSearchBar
                      defaultQuery={initialData?.query ?? ''}
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
            <ListItem>{t('Choose a metric')}</ListItem>
            <FormRow>
              <MetricField
                name="aggregate"
                help={null}
                organization={organization}
                disabled={disabled}
                style={{
                  ...formElemBaseStyle,
                }}
                inline={false}
                flexibleControlStateSize
                columnWidth={250}
                inFieldLabels
                required
              />
              <FormRowText>{t('over a')}</FormRowText>
              <Tooltip
                title={t('Triggers are evaluated every minute regardless of this value.')}
              >
                <SelectField
                  name="timeWindow"
                  style={{
                    ...formElemBaseStyle,
                    flex: 1,
                    minWidth: 180,
                  }}
                  choices={Object.entries(TIME_WINDOW_MAP)}
                  required
                  isDisabled={disabled}
                  getValue={value => Number(value)}
                  setValue={value => `${value}`}
                  inline={false}
                  flexibleControlStateSize
                />
              </Tooltip>
            </FormRow>
          </StyledList>
          {this.props.thresholdChart}
        </StyledPanelBody>
      </Panel>
    );
  }
}

const StyledPanelBody = styled(PanelBody)`
  ol,
  h4 {
    margin-bottom: ${space(1)};
  }
`;

const SearchContainer = styled('div')`
  display: flex;
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledList = styled(List)`
  padding: ${space(3)} ${space(3)} 0 ${space(3)};
`;

const FormRow = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: ${space(2)};
`;

const FormRowText = styled('div')`
  padding: ${space(0.5)};
  /* Match the height of the select controls */
  line-height: 36px;
`;

export default RuleConditionsFormForWizard;
