import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import WidgetQueryFields from 'app/components/dashboards/widgetQueryFields';
import SelectControl from 'app/components/forms/selectControl';
import * as Layout from 'app/components/layouts/thirds';
import List from 'app/components/list';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'app/types';
import Measurements from 'app/utils/measurements/measurements';
import routeTitleGen from 'app/utils/routeTitle';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withTags from 'app/utils/withTags';
import AsyncView from 'app/views/asyncView';
import {Widget, WidgetQuery} from 'app/views/dashboardsV2/types';
import {generateFieldOptions} from 'app/views/eventsV2/utils';

import {DISPLAY_TYPE_CHOICES} from '../../data';

import BuildStep from './buildStep';
import Chart from './chart';

type RouteParams = {
  orgId: string;
};

type Props = AsyncView['props'] &
  RouteComponentProps<RouteParams, {}> & {
    organization: Organization;
    tags: TagCollection;
    selection: GlobalSelection;
  };

type State = AsyncView['state'] & {
  visualization: Widget['displayType'];
  queries: Widget['queries'];
  errors: Record<string, any>;
};

const newQuery = {
  name: '',
  fields: ['count()'],
  conditions: '',
  orderby: '',
};

class WidgetNew extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      visualization: 'line',
      queries: [{...newQuery}],
      errors: {},
    };
  }

  getTitle() {
    const {params} = this.props;
    return routeTitleGen(t('Dashboards - Widget Builder'), params.orgId, false);
  }

  handleFieldChange<F extends keyof State>(field: F, value: State[F]) {
    this.setState(state => ({...state, [field]: value}));
  }

  handleQueryChange = (widgetQuery: WidgetQuery, index: number) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      set(newState, `queries.${index}`, widgetQuery);

      return {...newState, errors: {}};
    });
  };

  handleQueryRemove = (index: number) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      newState.queries.splice(index, index + 1);

      return {...newState, errors: {}};
    });
  };

  handleAddSearchConditions = () => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.push(cloneDeep(newQuery));

      return newState;
    });
  };

  canAddSearchConditions() {
    const {visualization, queries} = this.state;

    const rightDisplayType = ['line', 'area', 'stacked_area', 'bar'].includes(
      visualization
    );
    const underQueryLimit = queries.length < 3;

    return rightDisplayType && underQueryLimit;
  }

  render() {
    const {params, organization, tags} = this.props;
    const {visualization, queries, errors} = this.state;

    const fieldOptions = (measurementKeys: string[]) =>
      generateFieldOptions({
        organization,
        tagKeys: Object.values(tags).map(({key}) => key),
        measurementKeys,
      });

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
            <Layout.Title>{t('Custom Metrics Widget')}</Layout.Title>
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
                  name="visualization"
                  options={DISPLAY_TYPE_CHOICES.slice()}
                  value={visualization}
                  onChange={(option: {label: string; value: Widget['displayType']}) => {
                    this.handleFieldChange('visualization', option.value);
                  }}
                />
                <Chart />
              </VisualizationWrapper>
            </BuildStep>
            <BuildStep
              title={t('Begin your search')}
              description={t(
                'Add another query to compare projects, organizations, etc.'
              )}
            >
              {null}
            </BuildStep>
            <BuildStep
              title={t('Choose your y-axis')}
              description={t(
                'We’ll use this to determine what gets graphed in the y-axis and any additional overlays.'
              )}
            >
              <Measurements>
                {({measurements}) => {
                  const measurementKeys = Object.values(measurements).map(({key}) => key);
                  const amendedFieldOptions = fieldOptions(measurementKeys);
                  return (
                    <WidgetQueryFields
                      displayType={visualization}
                      fieldOptions={amendedFieldOptions}
                      errors={errors.fields}
                      fields={queries[0].fields}
                      onChange={fields => {
                        queries.forEach((widgetQuery, queryIndex) => {
                          const newQueryFields = cloneDeep(widgetQuery);
                          newQueryFields.fields = fields;
                          this.handleQueryChange(newQueryFields, queryIndex);
                        });
                      }}
                      style={{padding: 0}}
                    />
                  );
                }}
              </Measurements>
            </BuildStep>
          </BuildSteps>
        </Layout.Body>
      </StyledPageContent>
    );
  }
}

export default withOrganization(withGlobalSelection(withTags(WidgetNew)));

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const BuildSteps = styled(List)`
  display: grid;
  grid-gap: ${space(3)};
  max-width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    max-width: 50%;
  }
`;

const VisualizationWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;
