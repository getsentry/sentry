import React from 'react';
import {RouteComponentProps} from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
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
import SearchQueryField from './searchQueryField';
import {MetricMeta, MetricQuery} from './types';

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
  metricMetas: MetricMeta[] | null;
  metricTags: string[] | null;
  queries: MetricQuery[];
  searchQuery?: string;
};

class MetricWidget extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      title: t('Custom Widget'),
      displayType: DisplayType.LINE,
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
    const projectSlug = this.project.slug;

    return [
      ['metricMetas', `/projects/${orgSlug}/${projectSlug}/metrics/meta/`],
      ['metricTags', `/projects/${orgSlug}/${projectSlug}/metrics/tags/`],
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
    this.setState(state => ({...state, [field]: value}));
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
    const {
      title,
      metricTags,
      searchQuery,
      metricMetas,
      queries,
      displayType,
    } = this.state;
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

    if (!metricTags || !metricMetas) {
      return null;
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
                    choices={[
                      DisplayType.LINE,
                      DisplayType.BAR,
                      DisplayType.AREA,
                    ].map(value => [value, displayTypes[value]])}
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
                    project={project}
                    widget={{
                      title,
                      searchQuery,
                      displayType,
                      groupings: queries,
                    }}
                  />
                </VisualizationWrapper>
              </BuildStep>
              <ChooseDataSetStep value={DataSet.METRICS} onChange={onChangeDataSet} />
              <BuildStep
                title={t('Begin your search')}
                description={t('Select a query to compare projects, tags, etc.')}
              >
                <SearchQueryField
                  api={this.api}
                  tags={metricTags}
                  orgSlug={orgSlug}
                  projectSlug={project.slug}
                  query={searchQuery}
                  onSearch={newQuery => this.handleFieldChange('searchQuery', newQuery)}
                  onBlur={newQuery => this.handleFieldChange('searchQuery', newQuery)}
                />
              </BuildStep>
              <BuildStep
                title={t('Choose your grouping')}
                description={t(
                  'We’ll use this to determine what gets graphed in the y-axis and any additional overlays.'
                )}
              >
                <Queries
                  metricMetas={metricMetas}
                  metricTags={metricTags}
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
