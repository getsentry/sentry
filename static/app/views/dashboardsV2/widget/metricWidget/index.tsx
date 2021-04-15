import React from 'react';
import {RouteComponentProps} from 'react-router';
import {components, OptionProps} from 'react-select';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import Highlight from 'app/components/highlight';
import * as Layout from 'app/components/layouts/thirds';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import PickProjectToContinue from 'app/components/pickProjectToContinue';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {GlobalSelection, Organization, Project} from 'app/types';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withProjects from 'app/utils/withProjects';
import AsyncView from 'app/views/asyncView';
import SelectField from 'app/views/settings/components/forms/selectField';

import BuildStep from '../buildStep';
import BuildSteps from '../buildSteps';
import ChooseDataSetStep from '../choseDataStep';
import Header from '../header';
import {DataSet} from '../utils';

import Card from './card';
import Queries from './queries';
import {Metric, MetricQuery} from './types';

const newQuery = {
  tags: '',
  groupBy: '',
  aggregation: '',
};

type Props = RouteComponentProps<{}, {}> &
  AsyncView['props'] & {
    organization: Organization;
    projects: Project[];
    loadingProjects: boolean;
    selection: GlobalSelection;
    onChangeDataSet: (dataSet: DataSet) => void;
  };

type State = AsyncView['state'] & {
  title: string;
  metrics: Metric[];
  queries: MetricQuery[];
  metric?: Metric;
};

class MetricWidget extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      title: t('Custom Widget'),
      metrics: [],
      queries: [{...newQuery}],
    };
  }

  componentDidMount() {
    this.fetchMetrics();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!this.isProjectMissingInUrl() && !this.state.metrics.length) {
      this.fetchMetrics();
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  async fetchMetrics() {
    if (this.isProjectMissingInUrl() || !!this.state.metrics.length) {
      return;
    }

    try {
      const newMetrics = await Promise.resolve([
        {
          name: 'session',
          type: 'counter',
          operations: ['sum'],
          tags: ['session.status', 'project', 'release'],
          unit: null,
        },
        {
          name: 'user',
          type: 'set',
          operations: ['count_unique'],
          tags: ['session.status', 'project', 'release'],
          unit: null,
        },
        {
          name: 'session.duration',
          type: 'distribution',
          operations: ['avg', 'p50', 'p75', 'p90', 'p95', 'p99', 'max'],
          tags: ['session.status', 'project', 'release'],
          unit: 'seconds',
        },
      ]);
      this.setState({metrics: newMetrics});
    } catch (error) {
      this.setState({error});
    }
  }

  handleTitleChange = (title: string) => {
    this.setState({title});
  };

  handleMetricChange = (metric: Metric) => {
    this.setState({metric, queries: [{...newQuery}]});
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
      newState.queries.push(cloneDeep(newQuery));
      return newState;
    });
  };

  handleChangeQuery = (index: number, query: MetricQuery) => {
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
    } = this.props;
    const {title, metrics, metric, queries} = this.state;
    const {query} = location;
    const {project: projectId} = query;
    const orgSlug = organization.slug;

    if (loadingProjects) {
      return this.renderLoading();
    }

    const selectedProject = projects.find(project => project.id === projectId);

    if (this.isProjectMissingInUrl() || !selectedProject) {
      return (
        <PickProjectToContinue
          router={router}
          projects={projects.map(project => ({id: project.id, slug: project.slug}))}
          nextPath={`/organizations/${orgSlug}/dashboards/widget/new/?dataSet=metrics`}
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
            onChangeTitle={this.handleTitleChange}
          />
          <Layout.Body>
            <BuildSteps>
              <Card
                router={router}
                location={location}
                selection={selection}
                organization={organization}
                api={this.api}
                project={selectedProject}
                widget={{
                  title,
                  queries,
                  yAxis: metric?.name,
                }}
              />
              <ChooseDataSetStep value={DataSet.METRICS} onChange={onChangeDataSet} />
              <BuildStep
                title={t('Choose your y-axis metric')}
                description={t('Determine what type of metric you want to graph by.')}
              >
                <StyledSelectField
                  name="metric"
                  choices={metrics.map(m => [m, m.name])}
                  placeholder={t('Select metric')}
                  onChange={this.handleMetricChange}
                  components={{
                    Option: ({
                      label,
                      ...optionProps
                    }: OptionProps<{
                      label: string;
                      value: string;
                    }>) => {
                      const {selectProps} = optionProps;
                      const {inputValue} = selectProps;

                      return (
                        <components.Option label={label} {...optionProps}>
                          <Highlight text={inputValue ?? ''}>{label}</Highlight>
                        </components.Option>
                      );
                    },
                  }}
                  inline={false}
                  flexibleControlStateSize
                  stacked
                  allowClear
                />
              </BuildStep>
              <BuildStep
                title={t('Begin your search')}
                description={t('Add another query to compare projects, tags, etc.')}
              >
                <Queries
                  organization={organization}
                  projectId={selectedProject.id}
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

export default withProjects(withGlobalSelection(MetricWidget));

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;
