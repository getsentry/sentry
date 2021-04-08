import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import SelectControl from 'app/components/forms/selectControl';
import * as Layout from 'app/components/layouts/thirds';
import List from 'app/components/list';
import {PanelAlert} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import {DisplayType, Widget, WidgetQuery} from 'app/views/dashboardsV2/types';
import WidgetCard from 'app/views/dashboardsV2/widgetCard';
import RadioField from 'app/views/settings/components/forms/radioField';

import BuildStep from './buildStep';
import EventSteps from './eventSteps';
import MetricSteps from './metricSteps';
import {displayTypes} from './utils';

enum DataSet {
  EVENTS = 'events',
  METRICS = 'metrics',
}

type RouteParams = {
  orgId: string;
};

type MetricQuery = React.ComponentProps<typeof MetricSteps>['metricQueries'][0];

type Props = AsyncView['props'] &
  RouteComponentProps<RouteParams, {}> & {
    organization: Organization;
    selection: GlobalSelection;
  };

type State = AsyncView['state'] & {
  title: string;
  displayType: DisplayType;
  interval: string;
  eventQueries: Widget['queries'];
  metricQueries: MetricQuery[];
  dataSet: DataSet;
  metric?: string;
};

const newEventQuery = {
  name: '',
  fields: ['count()'],
  conditions: '',
  orderby: '',
};

const newMetricQuery = {
  tags: '',
  groupBy: '',
  aggregation: '',
};

const dataSetChoices: [string, string][] = [
  ['events', t('Events')],
  ['metrics', t('Metrics')],
];

class WidgetNew extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      title: tct('Custom [displayType] Widget', {displayType: DisplayType.AREA}),
      displayType: DisplayType.AREA,
      interval: '5m',
      eventQueries: [{...newEventQuery}],
      metricQueries: [{...newMetricQuery}],
      dataSet: DataSet.EVENTS,
    };
  }

  getTitle() {
    const {params} = this.props;
    return routeTitleGen(t('Dashboards - Widget Builder'), params.orgId, false);
  }

  handleFieldChange = <F extends keyof State>(field: F, value: State[F]) => {
    if (field === 'displayType') {
      this.setState(state => ({
        ...state,
        [field]: value,
        title: tct('Custom [displayType] Widget', {displayType: displayTypes[value]}),
      }));
      return;
    }

    this.setState(state => ({...state, [field]: value}));
  };

  handleEventQueryChange = (index: number, widgetQuery: WidgetQuery) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      set(newState, `eventQueries.${index}`, widgetQuery);
      return newState;
    });
  };

  handleMetricQueryChange = (index: number, metricQuery: MetricQuery) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      set(newState, `metricQueries.${index}`, metricQuery);
      return newState;
    });
  };

  handleRemoveQuery = (index: number) => {
    this.setState(state => {
      const newState = cloneDeep(state);

      if (state.dataSet === DataSet.EVENTS) {
        newState.eventQueries.splice(index, index + 1);
        return newState;
      }

      newState.metricQueries.splice(index, index + 1);
      return newState;
    });
  };

  handleAddQuery = () => {
    this.setState(state => {
      const newState = cloneDeep(state);

      if (state.dataSet === DataSet.EVENTS) {
        newState.eventQueries.push(cloneDeep(newEventQuery));
        return newState;
      }

      newState.metricQueries.push(cloneDeep(newMetricQuery));
      return newState;
    });
  };

  render() {
    const {params, organization, selection} = this.props;
    const {
      displayType,
      dataSet,
      title,
      interval,
      eventQueries,
      metricQueries,
    } = this.state;

    return (
      <StyledPageContent>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  to: `/organizations/${params.orgId}/dashboards/`,
                  label: t('Dashboards'),
                },
                {label: t('Widget Builder')},
              ]}
            />
            <Layout.Title>{title}</Layout.Title>
          </Layout.HeaderContent>

          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <Button
                title={t(
                  "You’re seeing the metrics project because you have the feature flag 'organizations:metrics' enabled. Send us feedback via email."
                )}
                href="mailto:metrics-feedback@sentry.io?subject=Metrics Feedback"
              >
                {t('Give Feedback')}
              </Button>
              <Button priority="primary">{t('Save Widget')}</Button>
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>

        <Layout.Body>
          <BuildSteps symbol="colored-numeric">
            <BuildStep
              title={t('Choose your visualization')}
              description={t(
                'This is a preview of how your widget will appear in the dashboard.'
              )}
            >
              <VisualizationWrapper>
                <SelectControl
                  name="displayType"
                  options={Object.keys(displayTypes).map(value => ({
                    label: displayTypes[value],
                    value,
                  }))}
                  value={displayType}
                  onChange={(option: {label: string; value: DisplayType}) => {
                    this.handleFieldChange('displayType', option.value);
                  }}
                />
                <WidgetCard
                  api={this.api}
                  organization={organization}
                  selection={selection}
                  widget={{
                    title,
                    displayType,
                    queries: eventQueries,
                    interval,
                  }}
                  isEditing={false}
                  onDelete={() => undefined}
                  onEdit={() => undefined}
                  renderErrorMessage={errorMessage =>
                    typeof errorMessage === 'string' && (
                      <PanelAlert type="error">{errorMessage}</PanelAlert>
                    )
                  }
                  isSorting={false}
                  currentWidgetDragging={false}
                />
              </VisualizationWrapper>
            </BuildStep>
            <BuildStep
              title={t('Choose your data set')}
              description={t(
                'Monitor specific events such as errors and transactions or get metric readings on TBD.'
              )}
            >
              <RadioField
                name="dataSet"
                onChange={value => this.handleFieldChange('dataSet', value as DataSet)}
                value={dataSet}
                choices={dataSetChoices}
                inline={false}
                orientInline
                hideControlState
                stacked
              />
            </BuildStep>
            {dataSet === DataSet.METRICS ? (
              <MetricSteps
                metricQueries={metricQueries}
                onAddQuery={this.handleAddQuery}
                onRemoveQuery={this.handleRemoveQuery}
                onChangeQuery={this.handleMetricQueryChange}
                onChangeField={this.handleFieldChange}
              />
            ) : (
              <EventSteps
                selectedProjectIds={selection.projects}
                organization={organization}
                eventQueries={eventQueries}
                displayType={displayType}
                onAddQuery={this.handleAddQuery}
                onRemoveQuery={this.handleRemoveQuery}
                onChangeQuery={this.handleEventQueryChange}
              />
            )}
          </BuildSteps>
        </Layout.Body>
      </StyledPageContent>
    );
  }
}

export default withOrganization(withGlobalSelection(WidgetNew));

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const BuildSteps = styled(List)`
  display: grid;
  grid-gap: ${space(4)};
  max-width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    max-width: 50%;
  }
`;

const VisualizationWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;
