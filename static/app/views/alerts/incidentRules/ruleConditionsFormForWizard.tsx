import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import SearchBar from 'app/components/events/searchBar';
import SelectControl from 'app/components/forms/selectControl';
import ListItem from 'app/components/list/listItem';
import {Panel, PanelBody} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {IconQuestion} from 'app/icons';
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
import {AlertType, getFunctionHelpText} from 'app/views/alerts/wizard/options';
import FormField from 'app/views/settings/components/forms/formField';
import SelectField from 'app/views/settings/components/forms/selectField';

import {DEFAULT_AGGREGATE, DEFAULT_TRANSACTION_AGGREGATE} from './constants';
import MetricField from './metricField';
import {Datasource, TimeWindow} from './types';

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
  alertType: AlertType;
  allowChangeEventTypes?: boolean;
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
    const {organization, disabled, onFilterSearch, allowChangeEventTypes, alertType} =
      this.props;
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

    if (organization.features.includes('performance-view') && alertType === 'custom') {
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

    const {labelText: intervalLabelText, timeWindowText} = getFunctionHelpText(alertType);

    return (
      <React.Fragment>
        <ChartPanel>
          <StyledPanelBody>{this.props.thresholdChart}</StyledPanelBody>
        </ChartPanel>
        <StyledListItem>{t('Filter events')}</StyledListItem>
        <FormRow>
          <SelectField
            name="environment"
            placeholder={t('All')}
            style={{
              ...formElemBaseStyle,
              minWidth: 180,
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
            inFieldLabel={t('Env: ')}
          />
          {allowChangeEventTypes && (
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
                    inFieldLabel={t('Events: ')}
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
          )}
          <FormField
            name="query"
            inline={false}
            style={{
              ...formElemBaseStyle,
              flex: '6 0 500px',
            }}
            flexibleControlStateSize
          >
            {({onChange, onBlur, onKeyDown, initialData, model}) => (
              <SearchContainer>
                <StyledSearchBar
                  searchSource="alert_builder"
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
        <StyledListItem>
          <StyledListTitle>
            <div>{intervalLabelText}</div>
            <Tooltip
              title={t(
                'Time window over which the metric is evaluated. Alerts are evaluated every minute regardless of this value.'
              )}
            >
              <IconQuestion size="sm" color="gray200" />
            </Tooltip>
          </StyledListTitle>
        </StyledListItem>
        <FormRow>
          {timeWindowText && (
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
              columnWidth={200}
              alertType={alertType}
              required
            />
          )}
          {timeWindowText && <FormRowText>{timeWindowText}</FormRowText>}
          <SelectField
            name="timeWindow"
            style={{
              ...formElemBaseStyle,
              flex: '0 150px 0',
              minWidth: 130,
              maxWidth: 300,
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
      </React.Fragment>
    );
  }
}

const StyledListTitle = styled('div')`
  display: flex;
  span {
    margin-left: ${space(1)};
  }
`;

const ChartPanel = styled(Panel)`
  margin-bottom: ${space(4)};
`;

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

const FormRowText = styled('div')`
  margin: ${space(1)};
`;

export default RuleConditionsFormForWizard;
