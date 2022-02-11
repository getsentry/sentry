import {InjectedRouter} from 'react-router';
import {components, OptionProps, SingleValueProps} from 'react-select';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location, LocationDescriptor} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PickProjectToContinue from 'sentry/components/pickProjectToContinue';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {
  MetricMeta,
  MetricQuery,
  MetricTag,
  Organization,
  PageFilters,
  Project,
} from 'sentry/types';
import {Theme} from 'sentry/utils/theme';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import AsyncView from 'sentry/views/asyncView';
import SelectField from 'sentry/views/settings/components/forms/selectField';

import {DashboardDetails} from '../../types';
import BuildStep from '../buildStep';
import BuildSteps from '../buildSteps';
import ChooseDataSetStep from '../choseDataStep';
import Header from '../header';
import {DataSet, DisplayType, displayTypes} from '../utils';

import Card from './card';
import FiltersAndGroups from './filtersAndGroups';
import Queries from './queries';

type Props = AsyncView['props'] & {
  dashboardTitle: DashboardDetails['title'];
  goBackLocation: LocationDescriptor;
  loadingProjects: boolean;
  location: Location;
  onChangeDataSet: (dataSet: DataSet) => void;
  organization: Organization;
  projects: Project[];
  router: InjectedRouter;
  selection: PageFilters;
  theme: Theme;
};

type State = AsyncView['state'] &
  Pick<React.ComponentProps<typeof FiltersAndGroups>, 'groupBy' | 'searchQuery'> & {
    displayType: DisplayType;
    metricMetas: MetricMeta[] | null;
    metricTags: MetricTag[] | null;
    queries: MetricQuery[];
    title: string;
  };

class MetricWidget extends AsyncView<Props, State> {
  shouldReload = true;

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      title: t('Custom %s Widget', displayTypes[DisplayType.AREA]),
      displayType: DisplayType.AREA,
      metricMetas: [],
      metricTags: [],
      queries: [{}],
    };
  }

  get project() {
    const {projects, location} = this.props;
    const {query} = location;
    const {project: projectId} = query;

    return projects.find(project => project.id === projectId);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, loadingProjects} = this.props;

    if (this.isProjectMissingInUrl() || loadingProjects || !this.project) {
      return [];
    }

    const orgSlug = organization.slug;
    const projectId = this.project.id;

    return [
      [
        'metricMetas',
        `/organizations/${orgSlug}/metrics/meta/`,
        {query: {project: projectId}},
      ],
      [
        'metricTags',
        `/organizations/${orgSlug}/metrics/tags/`,
        {query: {project: projectId}},
      ],
    ];
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.loadingProjects && !this.props.loadingProjects) {
      this.reloadData();
    }

    if (!prevState.metricMetas?.length && !!this.state.metricMetas?.length) {
      this.handleChangeQuery(0, {metricMeta: this.state.metricMetas[0]});
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  handleFieldChange = <F extends keyof State>(field: F, value: State[F]) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      set(newState, field, value);

      if (field === 'displayType') {
        if (
          state.title === t('Custom %s Widget', state.displayType) ||
          state.title === t('Custom %s Widget', DisplayType.AREA)
        ) {
          return {
            ...newState,
            title: t('Custom %s Widget', displayTypes[value]),
            widgetErrors: undefined,
          };
        }
      }

      if (field === 'groupBy') {
        return {
          ...newState,
          queries: newState.queries.map(query => ({...query, groupBy: value})),
          widgetErrors: undefined,
        };
      }

      return {...newState, widgetErrors: undefined};
    });
  };

  handleRemoveQuery = (index: number) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      newState.queries.splice(index, 1);
      return newState;
    });
  };

  handleAddQuery = () => {
    this.setState(state => {
      const newState = cloneDeep(state);
      newState.queries.push({});
      return newState;
    });
  };

  handleChangeQuery = (index: number, query: MetricQuery) => {
    const isMetricNew =
      this.state.queries[index].metricMeta?.name !== query.metricMeta?.name;

    if (isMetricNew) {
      query.aggregation = query.metricMeta ? query.metricMeta.operations[0] : undefined;
    }

    this.setState(state => {
      const newState = cloneDeep(state);
      set(newState, `queries.${index}`, query);
      return newState;
    });
  };

  handleProjectChange = (projectId: number) => {
    const {router, location} = this.props;

    // if we change project, we need to sync the project slug in the URL
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        project: projectId,
      },
    });
  };

  isProjectMissingInUrl() {
    const projectId = this.props.location.query.project;
    return !projectId || typeof projectId !== 'string';
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      organization,
      router,
      projects,
      onChangeDataSet,
      selection,
      location,
      loadingProjects,
      goBackLocation,
      dashboardTitle,
    } = this.props;
    const {title, metricTags, searchQuery, groupBy, metricMetas, queries, displayType} =
      this.state;
    const orgSlug = organization.slug;

    if (loadingProjects) {
      return this.renderLoading();
    }

    const selectedProject = this.project;

    if (this.isProjectMissingInUrl() || !selectedProject) {
      return (
        <PickProjectToContinue
          router={router}
          projects={projects.map(project => ({id: project.id, slug: project.slug}))}
          nextPath={{
            pathname: location.pathname,
            query: location.query,
          }}
          noProjectRedirectPath={goBackLocation}
        />
      );
    }

    if (!metricTags || !metricMetas) {
      return null;
    }

    return (
      <StyledPageContent>
        <Header
          orgSlug={orgSlug}
          title={title}
          dashboardTitle={dashboardTitle}
          goBackLocation={goBackLocation}
          onChangeTitle={newTitle => this.handleFieldChange('title', newTitle)}
        />
        <Layout.Body>
          <BuildSteps>
            <ChooseDataSetStep value={DataSet.METRICS} onChange={onChangeDataSet} />
            <BuildStep
              title={t('Choose your visualization')}
              description={t(
                'This is a preview of how your widget will appear in the dashboard.'
              )}
            >
              <VisualizationWrapper>
                <StyledSelectField
                  name="displayType"
                  options={[DisplayType.LINE, DisplayType.BAR, DisplayType.AREA].map(
                    value => ({value, label: displayTypes[value]})
                  )}
                  value={displayType}
                  onChange={value => {
                    this.handleFieldChange('displayType', value);
                  }}
                  inline={false}
                  flexibleControlStateSize
                  stacked
                />
                <Card
                  router={router}
                  location={location}
                  selection={selection}
                  organization={organization}
                  api={this.api}
                  project={selectedProject}
                  widget={{
                    title,
                    searchQuery,
                    displayType,
                    groupings: queries,
                  }}
                />
              </VisualizationWrapper>
            </BuildStep>
            <BuildStep
              title={t('Choose your project')}
              description={t('You’ll need to select a project to set metrics on.')}
            >
              <StyledSelectField
                name="project"
                options={projects.map(project => ({value: project, label: project.slug}))}
                onChange={project => this.handleProjectChange(project.id)}
                value={selectedProject}
                components={{
                  Option: ({
                    label,
                    ...optionProps
                  }: OptionProps<{
                    label: string;
                    value: Project;
                  }>) => {
                    const {data} = optionProps;
                    return (
                      <components.Option label={label} {...optionProps}>
                        <ProjectBadge project={data.value} avatarSize={18} disableLink />
                      </components.Option>
                    );
                  },
                  SingleValue: ({
                    data,
                    ...props
                  }: SingleValueProps<{
                    label: string;
                    value: Project;
                  }>) => (
                    <components.SingleValue data={data} {...props}>
                      <ProjectBadge project={data.value} avatarSize={18} disableLink />
                    </components.SingleValue>
                  ),
                }}
                styles={{
                  control: provided => ({
                    ...provided,
                    boxShadow: 'none',
                  }),
                }}
                allowClear={false}
                inline={false}
                flexibleControlStateSize
                stacked
              />
            </BuildStep>
            <BuildStep
              title={t('Choose your metrics')}
              description={t(
                'We’ll use this to determine what gets graphed in the y-axis and any additional overlays.'
              )}
            >
              <Queries
                metricMetas={metricMetas}
                queries={queries}
                onAddQuery={this.handleAddQuery}
                onRemoveQuery={this.handleRemoveQuery}
                onChangeQuery={this.handleChangeQuery}
              />
            </BuildStep>
            <BuildStep
              title={t('Add filters and groups')}
              description={t('Select a tag to compare releases, session data, etc.')}
            >
              <FiltersAndGroups
                api={this.api}
                orgSlug={organization.slug}
                projectId={selectedProject.id}
                metricTags={metricTags}
                searchQuery={searchQuery}
                groupBy={groupBy}
                onChangeSearchQuery={value => {
                  this.handleFieldChange('searchQuery', value);
                }}
                onChangeGroupBy={value => {
                  this.handleFieldChange('groupBy', value);
                }}
              />
            </BuildStep>
          </BuildSteps>
        </Layout.Body>
      </StyledPageContent>
    );
  }
}

export default withTheme(withProjects(withPageFilters(MetricWidget)));

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

const VisualizationWrapper = styled('div')`
  display: grid;
  gap: ${space(1.5)};
`;
