import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import * as Layout from 'app/components/layouts/thirds';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import PickProjectToContinue from 'app/components/pickProjectToContinue';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Project} from 'app/types';
import {Theme} from 'app/utils/theme';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withProjects from 'app/utils/withProjects';
import AsyncView from 'app/views/asyncView';
import SelectField from 'app/views/settings/components/forms/selectField';

import BuildStep from '../buildStep';
import BuildSteps from '../buildSteps';
import ChooseDataSetStep from '../choseDataStep';
import Header from '../header';
import {DataSet, DisplayType, displayTypes} from '../utils';

import Card from './card';
import Queries from './queries';
import SearchBar from './searchBar';
import {Metric, MetricQuery} from './types';

const metricDisplayTypes = Object.keys(displayTypes).filter(
  displayType =>
    displayType !== DisplayType.BIG_NUMBER &&
    displayType !== DisplayType.TABLE &&
    displayType !== DisplayType.WORLD_MAP
);

type RouteParams = {
  dashboardId: string;
};

type Props = RouteComponentProps<RouteParams, {}> &
  AsyncView['props'] & {
    theme: Theme;
    organization: Organization;
    projects: Project[];
    loadingProjects: boolean;
    selection: GlobalSelection;
    onChangeDataSet: (dataSet: DataSet) => void;
  };

type State = AsyncView['state'] & {
  title: string;
  displayType: DisplayType;
  metrics: Metric[];
  queries: MetricQuery[];
  tags: string;
};

class MetricWidget extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      title: t('Custom Widget'),
      displayType: DisplayType.LINE,
      metrics: [],
      queries: [{}],
      tags: '',
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

    return [['metrics', `/projects/${organization.slug}/${this.project.slug}/metrics/`]];
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.loadingProjects && !this.props.loadingProjects) {
      this.reloadData();
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  handleFieldChange = <F extends keyof State>(field: F, value: State[F]) => {
    this.setState(state => ({...state, [field]: value}));
  };

  handleRemoveQuery = (index: number) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      newState.queries.splice(index, index + 1);
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
    const isMetricNew = this.state.queries[index].metric?.name !== query.metric?.name;

    if (isMetricNew) {
      query.aggregation = undefined;
    }

    this.setState(state => {
      const newState = cloneDeep(state);
      set(newState, `queries.${index}`, query);
      return newState;
    });
  };

  handleProjectChange = (selectedProjects: number[]) => {
    const {projects, router, location, organization} = this.props;

    const newlySelectedProject = projects.find(p => p.id === String(selectedProjects[0]));

    // if we change project in global header, we need to sync the project slug in the URL
    if (newlySelectedProject?.id) {
      router.replace({
        pathname: `/organizations/${organization.slug}/dashboards/widget/new/`,
        query: {
          ...location.query,
          project: newlySelectedProject.id,
          environment: undefined,
        },
      });
    }
  };

  isProjectMissingInUrl() {
    const projectId = this.props.location.query.project;
    return !projectId || typeof projectId !== 'string';
  }

  async handleSave() {
    //wip
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
      params,
    } = this.props;
    const {dashboardId} = params;
    const {title, metrics, metric, queries, displayType} = this.state;
    const orgSlug = organization.slug;

    if (loadingProjects) {
      return this.renderLoading();
    }

    const project = this.project;

    if (this.isProjectMissingInUrl() || !project) {
      return (
        <PickProjectToContinue
          router={router}
          projects={projects.map(p => ({id: p.id, slug: p.slug}))}
          nextPath={`/organizations/${orgSlug}/dashboards/${dashboardId}/widget/new/?dataSet=metrics`}
          noProjectRedirectPath={`/organizations/${orgSlug}/dashboards/`}
        />
      );
    }

    return (
      <GlobalSelectionHeader
        onUpdateProjects={this.handleProjectChange}
        disableMultipleProjectSelection
        skipLoadLastUsed
      >
        <StyledPageContent>
          <Header
            orgSlug={orgSlug}
            title={title}
            onChangeTitle={newTitle => this.handleFieldChange('title', newTitle)}
            onSave={this.handleSave}
          />
          <Layout.Body>
            <BuildSteps>
              <BuildStep
                title={t('Choose your visualization')}
                description={t(
                  'This is a preview of how your widget will appear in the dashboard.'
                )}
              >
                <VisualizationWrapper>
                  <StyledSelectField
                    name="displayType"
                    choices={metricDisplayTypes.map(value => [
                      value,
                      displayTypes[value],
                    ])}
                    value={displayType}
                    onChange={(option: {label: string; value: DisplayType}) => {
                      this.handleFieldChange('displayType', option.value);
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
                    project={project}
                    widget={{
                      title,
                      queries,
                    }}
                  />
                </VisualizationWrapper>
              </BuildStep>
              <ChooseDataSetStep value={DataSet.METRICS} onChange={onChangeDataSet} />
              <BuildStep
                title={t('Begin your search')}
                description={t('Select a query to compare projects, tags, etc.')}
              >
                <SearchBar
                  api={this.api}
                  metricName={metric?.name ?? ''}
                  tags={metric?.tags ?? []}
                  orgSlug={orgSlug}
                  projectSlug={project.slug}
                  query=""
                  onBlur={value => this.handleFieldChange('tags', value)}
                />
              </BuildStep>
              <BuildStep
                title={t('Choose your grouping')}
                description={t(
                  'We’ll use this to determine what gets graphed in the y-axis and any additional overlays.'
                )}
              >
                <Queries
                  metrics={metrics}
                  metric={metric}
                  queries={queries}
                  onAddQuery={this.handleAddQuery}
                  onRemoveQuery={this.handleRemoveQuery}
                  onChangeQuery={this.handleChangeQuery}
                />
              </BuildStep>
            </BuildSteps>
          </Layout.Body>
        </StyledPageContent>
      </GlobalSelectionHeader>
    );
  }
}

export default withTheme(withProjects(withGlobalSelection(MetricWidget)));

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

const VisualizationWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;
