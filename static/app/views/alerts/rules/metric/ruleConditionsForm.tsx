import {Fragment, PureComponent} from 'react';
import {InjectedRouter} from 'react-router';
import {components} from 'react-select';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {
  OnDemandMetricAlert,
  OnDemandWarningIcon,
} from 'sentry/components/alerts/onDemandMetricAlert';
import SearchBar from 'sentry/components/events/searchBar';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import SelectField from 'sentry/components/forms/fields/selectField';
import FormField from 'sentry/components/forms/formField';
import IdBadge from 'sentry/components/idBadge';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import {SearchInvalidTag} from 'sentry/components/smartSearchBar/searchInvalidTag';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Environment, Organization, Project, SelectValue} from 'sentry/types';
import {getDisplayName} from 'sentry/utils/environment';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import {getMRI} from 'sentry/utils/metrics/mri';
import {getOnDemandKeys, isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricAlertFeature} from 'sentry/utils/onDemandMetrics/features';
import withApi from 'sentry/utils/withApi';
import withProjects from 'sentry/utils/withProjects';
import WizardField from 'sentry/views/alerts/rules/metric/wizardField';
import {
  convertDatasetEventTypesToSource,
  DATA_SOURCE_LABELS,
  DATA_SOURCE_TO_SET_AND_EVENT_TYPES,
} from 'sentry/views/alerts/utils';
import {AlertType, getSupportedAndOmittedTags} from 'sentry/views/alerts/wizard/options';
import {MetricSearchBar} from 'sentry/views/ddm/queryBuilder';

import {getProjectOptions} from '../utils';

import {isCrashFreeAlert} from './utils/isCrashFreeAlert';
import {DEFAULT_AGGREGATE, DEFAULT_TRANSACTION_AGGREGATE} from './constants';
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
  aggregate: string;
  alertType: AlertType;
  api: Client;
  comparisonType: AlertRuleComparisonType;
  dataset: Dataset;
  disabled: boolean;
  onComparisonDeltaChange: (value: number) => void;
  onFilterSearch: (query: string, isQueryValid) => void;
  onTimeWindowChange: (value: number) => void;
  organization: Organization;
  project: Project;
  projects: Project[];
  router: InjectedRouter;
  thresholdChart: React.ReactNode;
  timeWindow: number;
  allowChangeEventTypes?: boolean;
  comparisonDelta?: number;
  disableProjectSelector?: boolean;
  isErrorMigration?: boolean;
  isExtrapolatedChartData?: boolean;
  isTransactionMigration?: boolean;
  loadingProjects?: boolean;
};

type State = {
  environments: Environment[] | null;
};

class RuleConditionsForm extends PureComponent<Props, State> {
  state: State = {
    environments: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.project.id === this.props.project.id) {
      return;
    }

    this.fetchData();
  }

  formElemBaseStyle = {
    padding: `${space(0.5)}`,
    border: 'none',
  };

  async fetchData() {
    const {api, organization, project} = this.props;

    try {
      const environments = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/environments/`,
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

    if (isCrashFreeAlert(this.props.dataset)) {
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
      label: tct('[timeWindow] interval', {
        timeWindow: label.slice(-1) === 's' ? label.slice(0, -1) : label,
      }),
    }));
  }

  get searchPlaceholder() {
    switch (this.props.dataset) {
      case Dataset.ERRORS:
        return t('Filter events by level, message, and other properties\u2026');
      case Dataset.METRICS:
      case Dataset.SESSIONS:
        return t('Filter sessions by release version\u2026');
      default:
        return t('Filter transactions by URL, tags, and other properties\u2026');
    }
  }

  renderEventTypeFilter() {
    const {organization, disabled, alertType, isErrorMigration} = this.props;

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

    if (
      organization.features.includes('performance-view') &&
      (alertType === 'custom_transactions' || alertType === 'custom_metrics')
    ) {
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

    return (
      <FormField
        name="datasource"
        inline={false}
        style={{
          ...this.formElemBaseStyle,
          minWidth: 300,
          flex: 2,
        }}
        flexibleControlStateSize
      >
        {({onChange, onBlur, model}) => {
          const formDataset = model.getValue('dataset');
          const formEventTypes = model.getValue('eventTypes');
          const aggregate = model.getValue('aggregate');
          const mappedValue = convertDatasetEventTypesToSource(
            formDataset,
            formEventTypes
          );
          return (
            <SelectControl
              value={mappedValue}
              inFieldLabel={t('Events: ')}
              onChange={({value}) => {
                onChange(value, {});
                onBlur(value, {});
                // Reset the aggregate to the default (which works across
                // datatypes), otherwise we may send snuba an invalid query
                // (transaction aggregate on events datasource = bad).
                const newAggregate =
                  value === Datasource.TRANSACTION
                    ? DEFAULT_TRANSACTION_AGGREGATE
                    : DEFAULT_AGGREGATE;
                if (alertType === 'custom_transactions' && aggregate !== newAggregate) {
                  model.setValue('aggregate', newAggregate);
                }

                // set the value of the dataset and event type from data source
                const {dataset: datasetFromDataSource, eventTypes} =
                  DATA_SOURCE_TO_SET_AND_EVENT_TYPES[value] ?? {};

                model.setValue('dataset', datasetFromDataSource);
                model.setValue('eventTypes', eventTypes);
              }}
              options={dataSourceOptions}
              isDisabled={disabled || isErrorMigration}
            />
          );
        }}
      </FormField>
    );
  }

  renderProjectSelector() {
    const {
      project: _selectedProject,
      projects,
      disabled,
      organization,
      disableProjectSelector,
    } = this.props;
    const projectOptions = getProjectOptions({
      organization,
      projects,
      isFormDisabled: disabled,
    });

    return (
      <FormField
        name="projectId"
        inline={false}
        style={{
          ...this.formElemBaseStyle,
          minWidth: 300,
          flex: 2,
        }}
        flexibleControlStateSize
      >
        {({onChange, onBlur, model}) => {
          const selectedProject =
            projects.find(({id}) => id === model.getValue('projectId')) ||
            _selectedProject;

          return (
            <SelectControl
              isDisabled={disabled || disableProjectSelector}
              value={selectedProject.id}
              options={projectOptions}
              onChange={({value}: {value: Project['id']}) => {
                // if the current owner/team isn't part of project selected, update to the first available team
                const nextSelectedProject =
                  projects.find(({id}) => id === value) ?? selectedProject;
                const ownerId: string | undefined = model
                  .getValue('owner')
                  ?.split(':')[1];
                if (
                  ownerId &&
                  nextSelectedProject.teams.find(({id}) => id === ownerId) ===
                    undefined &&
                  nextSelectedProject.teams.length
                ) {
                  model.setValue('owner', `team:${nextSelectedProject.teams[0].id}`);
                }
                onChange(value, {});
                onBlur(value, {});
              }}
              components={{
                SingleValue: containerProps => (
                  <components.ValueContainer {...containerProps}>
                    <IdBadge
                      project={selectedProject}
                      avatarProps={{consistentWidth: true}}
                      avatarSize={18}
                      disableLink
                    />
                  </components.ValueContainer>
                ),
              }}
            />
          );
        }}
      </FormField>
    );
  }

  renderInterval() {
    const {organization, disabled, alertType, timeWindow, onTimeWindowChange, project} =
      this.props;

    return (
      <Fragment>
        <StyledListItem>
          <StyledListTitle>
            <div>{t('Define your metric')}</div>
          </StyledListTitle>
        </StyledListItem>
        <FormRow>
          <WizardField
            name="aggregate"
            help={null}
            organization={organization}
            disabled={disabled}
            project={project}
            style={{
              ...this.formElemBaseStyle,
              flex: 1,
            }}
            inline={false}
            flexibleControlStateSize
            columnWidth={200}
            alertType={alertType}
            required
          />
          <SelectControl
            name="timeWindow"
            styles={{
              control: (provided: {[x: string]: string | number | boolean}) => ({
                ...provided,
                minWidth: 200,
                maxWidth: 300,
              }),
              container: (provided: {[x: string]: string | number | boolean}) => ({
                ...provided,
                margin: `${space(0.5)}`,
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
        </FormRow>
      </Fragment>
    );
  }

  render() {
    const {
      alertType,
      organization,
      disabled,
      onFilterSearch,
      allowChangeEventTypes,
      dataset,
      isExtrapolatedChartData,
      isTransactionMigration,
      isErrorMigration,
      aggregate,
      project,
    } = this.props;

    const {environments} = this.state;

    const environmentOptions: SelectValue<string | null>[] = [
      {
        value: null,
        label: t('All Environments'),
      },
      ...(environments?.map(env => ({value: env.name, label: getDisplayName(env)})) ??
        []),
    ];

    return (
      <Fragment>
        <ChartPanel>
          <StyledPanelBody>{this.props.thresholdChart}</StyledPanelBody>
        </ChartPanel>
        {isTransactionMigration ? (
          <Fragment>
            <Spacer />
            <HiddenListItem />
            <HiddenListItem />
          </Fragment>
        ) : (
          <Fragment>
            {isExtrapolatedChartData && (
              <OnDemandMetricAlert
                message={t(
                  'The chart data above is an estimate based on the stored transactions that match the filters specified.'
                )}
              />
            )}
            {!isErrorMigration && this.renderInterval()}
            <StyledListItem>{t('Filter events')}</StyledListItem>
            <FormRow noMargin columns={1 + (allowChangeEventTypes ? 1 : 0) + 1}>
              {this.renderProjectSelector()}
              <SelectField
                name="environment"
                placeholder={t('All Environments')}
                style={{
                  ...this.formElemBaseStyle,
                  minWidth: 230,
                  flex: 1,
                }}
                styles={{
                  singleValue: (base: any) => ({
                    ...base,
                  }),
                  option: (base: any) => ({
                    ...base,
                  }),
                }}
                options={environmentOptions}
                isDisabled={
                  disabled || this.state.environments === null || isErrorMigration
                }
                isClearable
                inline={false}
                flexibleControlStateSize
              />
              {allowChangeEventTypes && this.renderEventTypeFilter()}
            </FormRow>
            <FormRow>
              <FormField
                name="query"
                inline={false}
                style={{
                  ...this.formElemBaseStyle,
                  flex: '6 0 500px',
                }}
                flexibleControlStateSize
              >
                {({onChange, onBlur, onKeyDown, initialData, value}) => {
                  return hasDDMFeature(organization) && alertType === 'custom_metrics' ? (
                    <MetricSearchBar
                      mri={getMRI(aggregate)}
                      projectIds={[project.id]}
                      placeholder={this.searchPlaceholder}
                      query={initialData.query}
                      defaultQuery={initialData?.query ?? ''}
                      useFormWrapper={false}
                      searchSource="alert_builder"
                      onChange={query => {
                        onFilterSearch(query, true);
                        onChange(query, {});
                      }}
                    />
                  ) : (
                    <SearchContainer>
                      <StyledSearchBar
                        disallowWildcard={dataset === Dataset.SESSIONS}
                        disallowFreeText={[
                          Dataset.GENERIC_METRICS,
                          Dataset.TRANSACTIONS,
                        ].includes(dataset)}
                        invalidMessages={{
                          [InvalidReason.WILDCARD_NOT_ALLOWED]: t(
                            'The wildcard operator is not supported here.'
                          ),
                          [InvalidReason.FREE_TEXT_NOT_ALLOWED]: t(
                            'Free text search is not allowed. If you want to partially match transaction names, use glob patterns like "transaction:*transaction-name*"'
                          ),
                        }}
                        customInvalidTagMessage={item => {
                          if (dataset !== Dataset.GENERIC_METRICS) {
                            return null;
                          }
                          return (
                            <SearchInvalidTag
                              message={tct(
                                "The field [field] isn't supported for performance alerts.",
                                {
                                  field: <code>{item.desc}</code>,
                                }
                              )}
                              docLink="https://docs.sentry.io/product/alerts/create-alerts/metric-alert-config/#tags--properties"
                            />
                          );
                        }}
                        searchSource="alert_builder"
                        defaultQuery={initialData?.query ?? ''}
                        {...getSupportedAndOmittedTags(dataset, organization)}
                        includeSessionTagsValues={dataset === Dataset.SESSIONS}
                        disabled={disabled || isErrorMigration}
                        useFormWrapper={false}
                        organization={organization}
                        placeholder={this.searchPlaceholder}
                        onChange={onChange}
                        query={initialData.query}
                        // We only need strict validation for Transaction queries, everything else is fine
                        highlightUnsupportedTags={
                          organization.features.includes('alert-allow-indexed') ||
                          (hasOnDemandMetricAlertFeature(organization) &&
                            isOnDemandQueryString(initialData.query))
                            ? false
                            : dataset === Dataset.GENERIC_METRICS
                        }
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
                        onClose={(query, {validSearch}) => {
                          onFilterSearch(query, validSearch);
                          onBlur(query);
                        }}
                        onSearch={query => {
                          onFilterSearch(query, true);
                          onChange(query, {});
                        }}
                        hasRecentSearches={dataset !== Dataset.SESSIONS}
                      />
                      {isExtrapolatedChartData && isOnDemandQueryString(value) && (
                        <OnDemandWarningIcon
                          color="gray500"
                          msg={tct(
                            `We don’t routinely collect metrics from [fields]. However, we’ll do so [strong:once this alert has been saved.]`,
                            {
                              fields: (
                                <strong>
                                  {getOnDemandKeys(value)
                                    .map(key => `"${key}"`)
                                    .join(', ')}
                                </strong>
                              ),
                              strong: <strong />,
                            }
                          )}
                        />
                      )}
                    </SearchContainer>
                  );
                }}
              </FormField>
            </FormRow>
          </Fragment>
        )}
      </Fragment>
    );
  }
}

const StyledListTitle = styled('div')`
  display: flex;
  span {
    margin-left: ${space(1)};
  }
`;

// This is a temporary hacky solution to hide list items without changing the numbering of the rest of the list
// TODO(issues): Remove this once the migration is complete
const HiddenListItem = styled(ListItem)`
  position: absolute;
  width: 0px;
  height: 0px;
  opacity: 0;
  pointer-events: none;
`;

const Spacer = styled('div')`
  margin-bottom: ${space(2)};
`;

const ChartPanel = styled(Panel)`
  margin-bottom: ${space(1)};
`;

const StyledPanelBody = styled(PanelBody)`
  ol,
  h4 {
    margin-bottom: ${space(1)};
  }
`;

const SearchContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;

  ${p =>
    p.disabled &&
    `
    background: ${p.theme.backgroundSecondary};
    color: ${p.theme.disabled};
    cursor: not-allowed;
  `}
`;

const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1.3;
`;

const FormRow = styled('div')<{columns?: number; noMargin?: boolean}>`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${p => (p.noMargin ? 0 : space(4))};
  ${p =>
    p.columns !== undefined &&
    css`
      display: grid;
      grid-template-columns: repeat(${p.columns}, auto);
    `}
`;

export default withApi(withProjects(RuleConditionsForm));
