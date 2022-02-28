import * as React from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import SearchBar from 'sentry/components/events/searchBar';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import FormField from 'sentry/components/forms/formField';
import SelectControl from 'sentry/components/forms/selectControl';
import SelectField from 'sentry/components/forms/selectField';
import ListItem from 'sentry/components/list/listItem';
import {Panel, PanelBody} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Environment, Organization, SelectValue} from 'sentry/types';
import {MobileVital, WebVital} from 'sentry/utils/discover/fields';
import {getDisplayName} from 'sentry/utils/environment';
import theme from 'sentry/utils/theme';
import {
  convertDatasetEventTypesToSource,
  DATA_SOURCE_LABELS,
  DATA_SOURCE_TO_SET_AND_EVENT_TYPES,
} from 'sentry/views/alerts/utils';
import {AlertType, getFunctionHelpText} from 'sentry/views/alerts/wizard/options';

import {
  COMPARISON_DELTA_OPTIONS,
  DEFAULT_AGGREGATE,
  DEFAULT_TRANSACTION_AGGREGATE,
} from './constants';
import MetricField from './metricField';
import {AlertRuleComparisonType, Dataset, Datasource, TimeWindow} from './types';

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
  alertType: AlertType;
  api: Client;
  comparisonType: AlertRuleComparisonType;
  dataset: Dataset;
  disabled: boolean;
  hasAlertWizardV3: boolean;
  onComparisonDeltaChange: (value: number) => void;
  onComparisonTypeChange: (value: AlertRuleComparisonType) => void;
  onFilterSearch: (query: string) => void;
  onTimeWindowChange: (value: number) => void;
  organization: Organization;
  projectSlug: string;
  thresholdChart: React.ReactNode;
  timeWindow: number;
  allowChangeEventTypes?: boolean;
  comparisonDelta?: number;
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

  get timeWindowOptions() {
    let options: Record<string, string> = TIME_WINDOW_MAP;

    if (this.props.dataset === Dataset.SESSIONS) {
      options = pick(TIME_WINDOW_MAP, [
        // TimeWindow.THIRTY_MINUTES, leaving this option out until we figure out the sub-hour session resolution chart limitations
        TimeWindow.ONE_HOUR,
        TimeWindow.TWO_HOURS,
        TimeWindow.FOUR_HOURS,
        TimeWindow.ONE_DAY,
      ]);
    }

    return Object.entries(options).map(([value, label]) => ({
      value: parseInt(value, 10),
      label,
    }));
  }

  get searchPlaceholder() {
    switch (this.props.dataset) {
      case Dataset.ERRORS:
        return t('Filter events by level, message, and other properties\u2026');
      case Dataset.SESSIONS:
        return t('Filter sessions by release version\u2026');
      case Dataset.TRANSACTIONS:
      default:
        return t('Filter transactions by URL, tags, and other properties\u2026');
    }
  }

  get searchSupportedTags() {
    if (this.props.dataset === Dataset.SESSIONS) {
      return {
        release: {
          key: 'release',
          name: 'release',
        },
      };
    }

    return undefined;
  }

  renderInterval() {
    const {
      organization,
      dataset,
      disabled,
      alertType,
      hasAlertWizardV3,
      timeWindow,
      comparisonDelta,
      comparisonType,
      onComparisonTypeChange,
      onTimeWindowChange,
      onComparisonDeltaChange,
    } = this.props;

    const formElemBaseStyle = {
      padding: `${space(0.5)}`,
      border: 'none',
    };

    const {labelText, timeWindowText} = getFunctionHelpText(alertType);
    const intervalLabelText = hasAlertWizardV3 ? t('Define your metric') : labelText;

    return (
      <Fragment>
        {dataset !== Dataset.SESSIONS && (
          <Feature features={['organizations:change-alerts']} organization={organization}>
            <StyledListItem>{t('Select threshold type')}</StyledListItem>
            <FormRow>
              <RadioGroup
                style={{flex: 1}}
                disabled={disabled}
                choices={[
                  [AlertRuleComparisonType.COUNT, 'Count'],
                  [AlertRuleComparisonType.CHANGE, 'Percent Change'],
                ]}
                value={comparisonType}
                label={t('Threshold Type')}
                onChange={onComparisonTypeChange}
              />
            </FormRow>
          </Feature>
        )}
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
          <SelectControl
            name="timeWindow"
            styles={{
              control: (provided: {[x: string]: string | number | boolean}) => ({
                ...provided,
                minWidth: 130,
                maxWidth: 300,
              }),
            }}
            options={this.timeWindowOptions}
            required
            isDisabled={disabled}
            value={timeWindow}
            onChange={({value}) => onTimeWindowChange(value)}
            inline={false}
            flexibleControlStateSize
          />
          <Feature features={['organizations:change-alerts']} organization={organization}>
            {comparisonType === AlertRuleComparisonType.CHANGE && (
              <ComparisonContainer>
                {t(' compared to ')}
                <SelectControl
                  name="comparisonDelta"
                  styles={{
                    container: (provided: {[x: string]: string | number | boolean}) => ({
                      ...provided,
                      marginLeft: space(1),
                    }),
                    control: (provided: {[x: string]: string | number | boolean}) => ({
                      ...provided,
                      minWidth: 500,
                      maxWidth: 1000,
                    }),
                  }}
                  value={comparisonDelta}
                  onChange={({value}) => onComparisonDeltaChange(value)}
                  options={COMPARISON_DELTA_OPTIONS}
                  required={comparisonType === AlertRuleComparisonType.CHANGE}
                />
              </ComparisonContainer>
            )}
          </Feature>
        </FormRow>
      </Fragment>
    );
  }

  render() {
    const {
      organization,
      disabled,
      onFilterSearch,
      allowChangeEventTypes,
      alertType,
      hasAlertWizardV3,
      dataset,
    } = this.props;
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

    const transactionTags = [
      'transaction',
      'transaction.duration',
      'transaction.op',
      'transaction.status',
    ];
    const measurementTags = Object.values({...WebVital, ...MobileVital});
    const eventOmitTags =
      dataset === 'events' ? [...measurementTags, ...transactionTags] : [];

    const formElemBaseStyle = {
      padding: `${space(0.5)}`,
      border: 'none',
    };

    return (
      <React.Fragment>
        <ChartPanel>
          <StyledPanelBody>{this.props.thresholdChart}</StyledPanelBody>
        </ChartPanel>
        {hasAlertWizardV3 && this.renderInterval()}
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
                      const {dataset: datasetFromDataSource, eventTypes} =
                        DATA_SOURCE_TO_SET_AND_EVENT_TYPES[optionValue] ?? {};
                      model.setValue('dataset', datasetFromDataSource);
                      model.setValue('eventTypes', eventTypes);
                    }}
                    options={dataSourceOptions}
                    isDisabled={disabled}
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
            {({onChange, onBlur, onKeyDown, initialData}) => (
              <SearchContainer>
                <StyledSearchBar
                  searchSource="alert_builder"
                  defaultQuery={initialData?.query ?? ''}
                  omitTags={[
                    'event.type',
                    'release.version',
                    'release.stage',
                    'release.package',
                    'release.build',
                    'project',
                    ...eventOmitTags,
                  ]}
                  includeSessionTagsValues={dataset === Dataset.SESSIONS}
                  disabled={disabled}
                  useFormWrapper={false}
                  organization={organization}
                  placeholder={this.searchPlaceholder}
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
                  {...(this.searchSupportedTags
                    ? {supportedTags: this.searchSupportedTags}
                    : {})}
                  hasRecentSearches={dataset !== Dataset.SESSIONS}
                />
              </SearchContainer>
            )}
          </FormField>
        </FormRow>
        {!hasAlertWizardV3 && this.renderInterval()}
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

const ComparisonContainer = styled('div')`
  margin-left: ${space(1)};
  display: flex;
  flex-direction: row;
  align-items: center;
`;

export default RuleConditionsForm;
