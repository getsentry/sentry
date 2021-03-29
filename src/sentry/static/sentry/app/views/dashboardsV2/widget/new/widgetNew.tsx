import React from 'react';
import {RouteComponentProps} from 'react-router';
import {components, OptionProps} from 'react-select';
import styled from '@emotion/styled';

import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import SelectControl from 'app/components/forms/selectControl';
import Highlight from 'app/components/highlight';
import * as Layout from 'app/components/layouts/thirds';
import List from 'app/components/list';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';

import {DISPLAY_TYPE_CHOICES} from '../../data';

import BuildStep from './buildStep';
import Chart from './chart';
import {metricMockOptions, visualizationColors} from './utils';

type SelectControlOption = {
  label: string;
  value: string;
};

type RouteParams = {
  orgId: string;
};

type Props = AsyncView['props'] & RouteComponentProps<RouteParams, {}> & {};

type State = AsyncView['state'] & {
  metrics: Array<string>;
  visualization: {
    type: string;
    color: string;
  };
};

class WidgetNew extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      visualization: {
        type: 'line',
        color: 'purple',
      },
    };
  }

  getTitle() {
    const {params} = this.props;
    return routeTitleGen(t('Dashboards - Widget Builder'), params.orgId, false);
  }

  handleFieldChange<F extends keyof State>(field: F, value: State[F]) {
    this.setState(state => ({...state, [field]: value}));
  }

  render() {
    const {params} = this.props;
    const {visualization, metrics} = this.state;

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
              title={t('Graph your data')}
              description={t(
                'Choose the metric to graph by searching or selecting it from the dropdown.'
              )}
            >
              <SelectControl
                name="metrics"
                placeholder={t('Select a metric')}
                options={metricMockOptions.map(metricMockOption => ({
                  label: metricMockOption,
                  value: metricMockOption,
                }))}
                value={metrics}
                onChange={(options: Array<SelectControlOption>) => {
                  this.handleFieldChange(
                    'metrics',
                    options.map(option => option.value)
                  );
                }}
                components={{
                  Option: (option: OptionProps<SelectControlOption>) => {
                    const {label, selectProps} = option;
                    const {inputValue = ''} = selectProps;
                    return (
                      <components.Option {...option}>
                        <Highlight text={inputValue}>{label}</Highlight>
                      </components.Option>
                    );
                  },
                }}
                multiple
              />
            </BuildStep>
            <BuildStep
              title={t('Choose your visualization')}
              description={t(
                'This is a preview of how your widget will appear in the dashboard.'
              )}
            >
              <VisualizationWrapper>
                <VisualizationFields>
                  <SelectControl
                    name="visualizationDisplay"
                    options={DISPLAY_TYPE_CHOICES.slice()}
                    value={visualization.type}
                    onChange={(option: SelectControlOption) => {
                      this.handleFieldChange('visualization', {
                        ...visualization,
                        type: option.value,
                      });
                    }}
                  />
                  <SelectControl
                    name="visualizationColor"
                    options={visualizationColors.slice()}
                    value={visualization.color}
                    onChange={(option: SelectControlOption) => {
                      this.handleFieldChange('visualization', {
                        ...visualization,
                        color: option.value,
                      });
                    }}
                  />
                </VisualizationFields>
                <Chart />
              </VisualizationWrapper>
            </BuildStep>
          </BuildSteps>
        </Layout.Body>
      </StyledPageContent>
    );
  }
}

export default WidgetNew;

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const BuildSteps = styled(List)`
  display: grid;
  grid-gap: ${space(3)};
  max-width: calc(100% - 40%);
`;

const VisualizationFields = styled('div')`
  display: grid;
  grid-template-columns: 1fr minmax(200px, auto);
  grid-gap: ${space(1.5)};
`;

const VisualizationWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;
