import {Fragment, PureComponent} from 'react';
import {InjectedRouter} from 'react-router';
import {components} from 'react-select';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import SearchBar from 'sentry/components/events/searchBar';
import FormField from 'sentry/components/forms/formField';
import SelectControl from 'sentry/components/forms/selectControl';
import SelectField from 'sentry/components/forms/selectField';
import IdBadge from 'sentry/components/idBadge';
import ListItem from 'sentry/components/list/listItem';
import {Panel, PanelBody} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Environment, Organization, Project, SelectValue} from 'sentry/types';
import {MobileVital, WebVital} from 'sentry/utils/discover/fields';
import {getDisplayName} from 'sentry/utils/environment';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import withProjects from 'sentry/utils/withProjects';
import WizardField from 'sentry/views/alerts/rules/metric/wizardField';
import {
  convertDatasetEventTypesToSource,
  DATA_SOURCE_LABELS,
  DATA_SOURCE_TO_SET_AND_EVENT_TYPES,
} from 'sentry/views/alerts/utils';
import {AlertType, getFunctionHelpText} from 'sentry/views/alerts/wizard/options';

import {isCrashFreeAlert} from './utils/isCrashFreeAlert';
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
  onFilterSearch: (query: string) => void;
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
      label: this.props.hasAlertWizardV3
        ? tct('[timeWindow] interval', {
            timeWindow: label.slice(-1) === 's' ? label.slice(0, -1) : label,
          })
        : label,
    }));
  }

  get searchPlaceholder() {
    switch (this.props.dataset) {
      case Dataset.ERRORS:
        return t('Filter events by level, message, and other properties\u2026');
      case Dataset.METRICS:
      case Dataset.SESSIONS:
        return t('Filter sessions by release version\u2026');
      case Dataset.TRANSACTIONS:
      default:
        return t('Filter transactions by URL, tags, and other properties\u2026');
    }
  }

  get searchSupportedTags() {
    if (isCrashFreeAlert(this.props.dataset)) {
      return {
        release: {
          key: 'release',
          name: 'release',
        },
      };
    }

    return undefined;
  }

  renderEventTypeFilter() {
    const {organization, disabled, alertType} = this.props;

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
    );
  }

  renderIdBadge(project: Project) {
    return (
      <IdBadge
        project={project}
        avatarProps={{consistentWidth: true}}
        avatarSize={18}
        disableLink
        hideName
      />
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
    const hasOpenMembership = organization.features.includes('open-membership');
    const myProjects = projects.filter(project => project.hasAccess && project.isMember);
    const allProjects = projects.filter(
      project => project.hasAccess && !project.isMember
    );

    const myProjectOptions = myProjects.map(myProject => ({
      value: myProject.id,
      label: myProject.slug,
      leadingItems: this.renderIdBadge(myProject),
    }));

    const openMembershipProjects = [
      {
        label: t('My Projects'),
        options: myProjectOptions,
      },
      {
        label: t('All Projects'),
        options: allProjects.map(allProject => ({
          value: allProject.id,
          label: allProject.slug,
          leadingItems: this.renderIdBadge(allProject),
        })),
      },
    ];

    const projectOptions =
      hasOpenMembership || isActiveSuperuser()
        ? openMembershipProjects
        : myProjectOptions;

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
                const ownerId: String | undefined = model
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
    const {
      organization,
      disabled,
      alertType,
      hasAlertWizardV3,
      timeWindow,
      comparisonDelta,
      comparisonType,
      onTimeWindowChange,
      onComparisonDeltaChange,
    } = this.props;

    const {labelText, timeWindowText} = getFunctionHelpText(alertType);
    const intervalLabelText = hasAlertWizardV3 ? t('Define your metric') : labelText;

    return (
      <Fragment>
        <StyledListItem>
          <StyledListTitle>
            <div>{intervalLabelText}</div>
            {!hasAlertWizardV3 && (
              <Tooltip
                title={t(
                  'Time window over which the metric is evaluated. Alerts are evaluated every minute regardless of this value.'
                )}
              >
                <IconQuestion size="sm" color="gray200" />
              </Tooltip>
            )}
          </StyledListTitle>
        </StyledListItem>
        <FormRow>
          {hasAlertWizardV3 ? (
            <WizardField
              name="aggregate"
              help={null}
              organization={organization}
              disabled={disabled}
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
          ) : (
            <MetricField
              name="aggregate"
              help={null}
              organization={organization}
              disabled={disabled}
              style={{
                ...this.formElemBaseStyle,
              }}
              inline={false}
              flexibleControlStateSize
              columnWidth={200}
              alertType={alertType}
              required
            />
          )}
          {!hasAlertWizardV3 && timeWindowText && (
            <FormRowText>{timeWindowText}</FormRowText>
          )}
          <SelectControl
            name="timeWindow"
            styles={{
              control: (provided: {[x: string]: string | number | boolean}) => ({
                ...provided,
                minWidth: hasAlertWizardV3 ? 200 : 130,
                maxWidth: 300,
              }),
              container: (provided: {[x: string]: string | number | boolean}) => ({
                ...provided,
                margin: hasAlertWizardV3 ? `${space(0.5)}` : 0,
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
          {!hasAlertWizardV3 && (
            <Feature
              features={['organizations:change-alerts']}
              organization={organization}
            >
              {comparisonType === AlertRuleComparisonType.CHANGE && (
                <ComparisonContainer>
                  {t(' compared to ')}
                  <SelectControl
                    name="comparisonDelta"
                    styles={{
                      container: (provided: {
                        [x: string]: string | number | boolean;
                      }) => ({
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
          )}
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
      hasAlertWizardV3,
      dataset,
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

    const transactionTags = [
      'transaction',
      'transaction.duration',
      'transaction.op',
      'transaction.status',
    ];
    const measurementTags = Object.values({...WebVital, ...MobileVital});
    const eventOmitTags =
      dataset === 'events' ? [...measurementTags, ...transactionTags] : [];

    return (
      <Fragment>
        <ChartPanel>
          <StyledPanelBody>{this.props.thresholdChart}</StyledPanelBody>
        </ChartPanel>
        {hasAlertWizardV3 && this.renderInterval()}
        <StyledListItem>{t('Filter events')}</StyledListItem>
        <FormRow
          noMargin
          columns={1 + (allowChangeEventTypes ? 1 : 0) + (hasAlertWizardV3 ? 1 : 0)}
        >
          {hasAlertWizardV3 && this.renderProjectSelector()}
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
            isDisabled={disabled || this.state.environments === null}
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
            {({onChange, onBlur, onKeyDown, initialData, model}) => (
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
                  query={model.getValue('query')}
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

const FormRowText = styled('div')`
  margin: ${space(1)};
`;

const ComparisonContainer = styled('div')`
  margin-left: ${space(1)};
  display: flex;
  flex-direction: row;
  align-items: center;
`;

export default withProjects(RuleConditionsForm);
