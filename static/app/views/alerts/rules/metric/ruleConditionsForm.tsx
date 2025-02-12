import {Fragment, PureComponent} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchTagValues} from 'sentry/actionCreators/tags';
import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import {
  OnDemandMetricAlert,
  OnDemandWarningIcon,
} from 'sentry/components/alerts/onDemandMetricAlert';
import {getHasTag} from 'sentry/components/events/searchBar';
import {
  STATIC_FIELD_TAGS,
  STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS,
  STATIC_FIELD_TAGS_WITHOUT_TRACING,
  STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS,
  STATIC_SEMVER_TAGS,
  STATIC_SPAN_TAGS,
} from 'sentry/components/events/searchBarFieldConstants';
import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import SelectField from 'sentry/components/forms/fields/selectField';
import FormField from 'sentry/components/forms/formField';
import IdBadge from 'sentry/components/idBadge';
import ListItem from 'sentry/components/list/listItem';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {EAPSpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Environment, Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {isAggregateField, isMeasurement} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getDisplayName} from 'sentry/utils/environment';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  DEVICE_CLASS_TAG_VALUES,
  FieldKind,
  isDeviceClass,
} from 'sentry/utils/fields';
import {
  getMeasurements,
  type MeasurementCollection,
} from 'sentry/utils/measurements/measurements';
import {getOnDemandKeys, isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricAlertFeature} from 'sentry/utils/onDemandMetrics/features';
import withApi from 'sentry/utils/withApi';
import withProjects from 'sentry/utils/withProjects';
import withTags from 'sentry/utils/withTags';
import WizardField from 'sentry/views/alerts/rules/metric/wizardField';
import {
  convertDatasetEventTypesToSource,
  DATA_SOURCE_LABELS,
  DATA_SOURCE_TO_SET_AND_EVENT_TYPES,
} from 'sentry/views/alerts/utils';
import type {AlertType} from 'sentry/views/alerts/wizard/options';
import {getSupportedAndOmittedTags} from 'sentry/views/alerts/wizard/options';
import {
  SpanTagsContext,
  SpanTagsProvider,
} from 'sentry/views/explore/contexts/spanTagsContext';
import {hasEAPAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';

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
  isEditing: boolean;
  onComparisonDeltaChange: (value: number) => void;
  onFilterSearch: (query: string, isQueryValid: any) => void;
  onTimeWindowChange: (value: number) => void;
  organization: Organization;
  project: Project;
  projects: Project[];
  router: InjectedRouter;
  tags: TagCollection;
  thresholdChart: React.ReactNode;
  timeWindow: number;
  // optional props
  allowChangeEventTypes?: boolean;
  comparisonDelta?: number;
  disableProjectSelector?: boolean;
  isErrorMigration?: boolean;
  isExtrapolatedChartData?: boolean;
  isForLlmMetric?: boolean;
  isLowConfidenceChartData?: boolean;
  isTransactionMigration?: boolean;
  loadingProjects?: boolean;
};

type State = {
  environments: Environment[] | null;
  filterKeys: TagCollection;
  measurements: MeasurementCollection;
};

class RuleConditionsForm extends PureComponent<Props, State> {
  state: State = {
    environments: null,
    measurements: {},
    filterKeys: {},
  };

  componentDidMount() {
    this.fetchData();
    const measurements = getMeasurements();
    const filterKeys = this.getFilterKeys();
    this.setState({measurements, filterKeys});
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.project.id === this.props.project.id) {
      return;
    }

    this.fetchData();
  }

  getFilterKeys = () => {
    const {organization, dataset, tags} = this.props;
    const {measurements} = this.state;
    const measurementsWithKind = Object.keys(measurements).reduce(
      (measurement_tags, key) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        measurement_tags[key] = {
          ...measurements[key],
          kind: FieldKind.MEASUREMENT,
        };
        return measurement_tags;
      },
      {}
    );
    const orgHasPerformanceView = organization.features.includes('performance-view');
    const combinedTags: TagCollection =
      dataset === Dataset.ERRORS
        ? Object.assign({}, STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS)
        : dataset === Dataset.TRANSACTIONS
          ? Object.assign(
              {},
              measurementsWithKind,
              STATIC_SPAN_TAGS,
              STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS
            )
          : orgHasPerformanceView
            ? Object.assign({}, measurementsWithKind, STATIC_SPAN_TAGS, STATIC_FIELD_TAGS)
            : Object.assign({}, STATIC_FIELD_TAGS_WITHOUT_TRACING);

    const tagsWithKind = Object.keys(tags).reduce<Record<string, Tag>>((acc, key) => {
      acc[key] = {
        ...tags[key]!,
        kind: FieldKind.TAG,
      };
      return acc;
    }, {});

    const {omitTags} = getSupportedAndOmittedTags(dataset, organization);

    Object.assign(combinedTags, tagsWithKind, STATIC_SEMVER_TAGS);
    combinedTags.has = getHasTag(combinedTags);

    const list =
      omitTags && omitTags.length > 0 ? omit(combinedTags, omitTags) : combinedTags;
    return list;
  };

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

  getEventFieldValues = async (tag: any, query: any): Promise<string[]> => {
    const {api, organization, project, dataset, router} = this.props;

    if (isAggregateField(tag.key) || isMeasurement(tag.key)) {
      // We can't really auto suggest values for aggregate fields
      // or measurements, so we simply don't
      // NOTE: these in particular are for discover queries. We may not need/support these
      return Promise.resolve([]);
    }

    // device.class is stored as "numbers" in snuba, but we want to suggest high, medium,
    // and low search filter values because discover maps device.class to these values.
    if (isDeviceClass(tag.key)) {
      return Promise.resolve(DEVICE_CLASS_TAG_VALUES);
    }

    const values = await fetchTagValues({
      api,
      orgSlug: organization.slug,
      tagKey: tag.key,
      search: query,
      projectIds: [project.id],
      endpointParams: normalizeDateTimeParams(router.location.query), // allows searching for tags on transactions as well
      includeTransactions: true, // allows searching for tags on sessions as well
      includeSessions: dataset === Dataset.SESSIONS,
    });

    return values.filter(({name}) => defined(name)).map(({name}) => name);
  };

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

    if (this.props.comparisonType === AlertRuleComparisonType.DYNAMIC) {
      options = pick(TIME_WINDOW_MAP, [
        TimeWindow.FIFTEEN_MINUTES,
        TimeWindow.THIRTY_MINUTES,
        TimeWindow.ONE_HOUR,
      ]);
    }

    if (this.props.dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
      options = pick(TIME_WINDOW_MAP, [
        TimeWindow.FIVE_MINUTES,
        TimeWindow.TEN_MINUTES,
        TimeWindow.FIFTEEN_MINUTES,
        TimeWindow.THIRTY_MINUTES,
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

  get selectControlStyles() {
    return {
      control: (provided: {[x: string]: string | number | boolean}) => ({
        ...provided,
        minWidth: 200,
        maxWidth: 300,
      }),
      container: (provided: {[x: string]: string | number | boolean}) => ({
        ...provided,
        margin: `${space(0.5)}`,
      }),
    };
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
      alertType === 'custom_transactions'
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
        {({onChange, onBlur, model}: any) => {
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
              onChange={({value}: any) => {
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
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
      projects, // note: org projects
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
        {({onChange, onBlur, model}: any) => {
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
                  model.setValue('owner', `team:${nextSelectedProject.teams[0]!.id}`);
                }
                onChange(value, {});
                onBlur(value, {});
              }}
              components={{
                SingleValue: (containerProps: any) => (
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
    const {
      organization,
      timeWindow,
      disabled,
      alertType,
      project,
      isForLlmMetric,
      onTimeWindowChange,
    } = this.props;

    return (
      <Fragment>
        <StyledListItem>
          <StyledListTitle>
            <div>{t('Define your metric')}</div>
          </StyledListTitle>
        </StyledListItem>
        <FormRow>
          {isForLlmMetric ? null : (
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
          )}
          <SelectControl
            name="timeWindow"
            styles={this.selectControlStyles}
            options={this.timeWindowOptions}
            isDisabled={disabled}
            value={timeWindow}
            onChange={({value}: any) => onTimeWindowChange(value)}
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
      project,
      comparisonType,
      isLowConfidenceChartData,
    } = this.props;

    const {environments, filterKeys} = this.state;
    const environmentOptions: Array<SelectValue<string | null>> = [
      {
        value: null,
        label: t('All Environments'),
      },
      ...(environments?.map(env => ({value: env.name, label: getDisplayName(env)})) ??
        []),
    ];

    const confidenceEnabled = hasEAPAlerts(organization);

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
            <SpanTagsProvider
              dataset={DiscoverDatasets.SPANS_EAP}
              enabled={
                organization.features.includes('alerts-eap') &&
                alertType === 'eap_metrics'
              }
            >
              {isExtrapolatedChartData && (
                <OnDemandMetricAlert
                  message={t(
                    'The chart data above is an estimate based on the stored transactions that match the filters specified.'
                  )}
                />
              )}
              {confidenceEnabled && isLowConfidenceChartData && (
                <Alert showIcon type="warning">
                  {t(
                    'Your low sample count may impact the accuracy of this alert. Edit your query or increase your sampling rate.'
                  )}
                </Alert>
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
              <FormRow noMargin>
                <FormField
                  name="query"
                  inline={false}
                  style={{
                    ...this.formElemBaseStyle,
                    flex: '6 0 500px',
                  }}
                  flexibleControlStateSize
                >
                  {({onChange, onBlur, initialData, value}: any) => {
                    return alertType === 'eap_metrics' ? (
                      <SpanTagsContext.Consumer>
                        {tags => (
                          <EAPSpanSearchQueryBuilder
                            numberTags={tags?.number ?? {}}
                            stringTags={tags?.string ?? {}}
                            initialQuery={value ?? ''}
                            searchSource="alerts"
                            onSearch={(query, {parsedQuery}) => {
                              onFilterSearch(query, parsedQuery);
                              onChange(query, {});
                            }}
                            supportedAggregates={ALLOWED_EXPLORE_VISUALIZE_AGGREGATES}
                            projects={[parseInt(project.id, 10)]}
                          />
                        )}
                      </SpanTagsContext.Consumer>
                    ) : (
                      <SearchContainer>
                        <SearchQueryBuilder
                          initialQuery={initialData?.query ?? ''}
                          getTagValues={this.getEventFieldValues}
                          placeholder={this.searchPlaceholder}
                          searchSource="alert_builder"
                          filterKeys={filterKeys}
                          disabled={disabled || isErrorMigration}
                          onChange={onChange}
                          invalidMessages={{
                            [InvalidReason.WILDCARD_NOT_ALLOWED]: t(
                              'The wildcard operator is not supported here.'
                            ),
                            [InvalidReason.FREE_TEXT_NOT_ALLOWED]: t(
                              'Free text search is not allowed. If you want to partially match transaction names, use glob patterns like "transaction:*transaction-name*"'
                            ),
                          }}
                          onSearch={query => {
                            onFilterSearch(query, true);
                            onChange(query, {});
                          }}
                          onBlur={(query, {parsedQuery}) => {
                            onFilterSearch(query, parsedQuery);
                            onBlur(query);
                          }}
                          // We only need strict validation for Transaction queries, everything else is fine
                          disallowUnsupportedFilters={
                            organization.features.includes('alert-allow-indexed') ||
                            (hasOnDemandMetricAlertFeature(organization) &&
                              isOnDemandQueryString(value))
                              ? false
                              : dataset === Dataset.GENERIC_METRICS
                          }
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
              <FormRow noMargin>
                <FormField
                  name="query"
                  inline={false}
                  style={{
                    ...this.formElemBaseStyle,
                    flex: '6 0 500px',
                  }}
                  flexibleControlStateSize
                >
                  {(args: any) => {
                    if (
                      args.value?.includes('is:unresolved') &&
                      comparisonType === AlertRuleComparisonType.DYNAMIC
                    ) {
                      return (
                        <OnDemandMetricAlert
                          message={t(
                            "'is:unresolved' queries are not supported by Anomaly Detection alerts."
                          )}
                        />
                      );
                    }
                    return null;
                  }}
                </FormField>
              </FormRow>
            </SpanTagsProvider>
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

export default withApi(withProjects(withTags(RuleConditionsForm)));
