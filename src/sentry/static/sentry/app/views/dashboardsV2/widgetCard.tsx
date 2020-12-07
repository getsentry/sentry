import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import BarChart from 'app/components/charts/barChart';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getSeriesSelection} from 'app/components/charts/utils';
import ErrorBoundary from 'app/components/errorBoundary';
import {Panel, PanelBody} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import {getAggregateArg, getMeasurementSlug} from 'app/utils/discover/fields';
import getDynamicText from 'app/utils/getDynamicText';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import {Widget} from './types';
import WidgetQueries from './widgetQueries';

type Props = ReactRouter.WithRouterProps & {
  api: Client;
  organization: Organization;
  widget: Widget;
  selection: GlobalSelection;
};

class WidgetCard extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props): boolean {
    if (
      !isEqual(nextProps.widget, this.props.widget) ||
      !isEqual(nextProps.selection, this.props.selection)
    ) {
      return true;
    }
    return false;
  }

  chartComponent(chartProps): React.ReactNode {
    const {widget} = this.props;

    switch (widget.displayType) {
      case 'bar':
        return <BarChart {...chartProps} />;
      case 'line':
      default:
        return <LineChart {...chartProps} />;
    }
  }

  renderVisual() {
    const {location, router, selection, api, organization, widget} = this.props;

    const statsPeriod = selection.datetime.period;
    const {start, end} = selection.datetime;
    const {projects, environments} = selection;

    const legend = {
      right: 10,
      top: 5,
      icon: 'circle',
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 12,
      align: 'left',
      type: 'plain',
      textStyle: {
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: 'Rubik',
      },
      selected: getSeriesSelection(location),
      formatter: (seriesName: string) => {
        const arg = getAggregateArg(seriesName);
        if (arg !== null) {
          const slug = getMeasurementSlug(arg);
          if (slug !== null) {
            seriesName = slug.toUpperCase();
          }
        }
        return seriesName;
      },
    };

    const axisField = widget.queries[0]?.fields?.[0] ?? 'count()';
    const chartOptions = {
      grid: {
        left: '10px',
        right: '10px',
        top: '40px',
        bottom: '0px',
      },
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: tooltipFormatter,
      },
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) => axisLabelFormatter(value, axisField),
        },
      },
    };

    return (
      <ChartZoom
        router={router}
        period={statsPeriod}
        start={start}
        end={end}
        projects={projects}
        environments={environments}
      >
        {zoomRenderProps => {
          return (
            <WidgetQueries
              api={api}
              organization={organization}
              widget={widget}
              selection={selection}
            >
              {({results, error, loading}) => {
                if (error) {
                  return (
                    <ErrorPanel>
                      <IconWarning color="gray500" size="lg" />
                    </ErrorPanel>
                  );
                }

                const colors = results
                  ? theme.charts.getColorPalette(results.length - 2)
                  : [];

                // Create a list of series based on the order of the fields,
                const series = results
                  ? results.map((values, i: number) => ({
                      ...values,
                      color: colors[i],
                    }))
                  : [];

                // Stack the toolbox under the legend.
                // so all series names are clickable.
                zoomRenderProps.toolBox.z = -1;

                return (
                  <TransitionChart loading={loading} reloading={loading}>
                    <TransparentLoadingMask visible={loading} />
                    {getDynamicText({
                      value: this.chartComponent({
                        ...zoomRenderProps,
                        ...chartOptions,
                        legend,
                        series,
                      }),
                      fixed: 'Widget Chart',
                    })}
                  </TransitionChart>
                );
              }}
            </WidgetQueries>
          );
        }}
      </ChartZoom>
    );
  }

  render() {
    const {widget} = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel>
          <WidgetHeader>{widget.title}</WidgetHeader>
          <StyledPanelBody>{this.renderVisual()}</StyledPanelBody>
        </StyledPanel>
      </ErrorBoundary>
    );
  }
}

export default withApi(
  withOrganization(withGlobalSelection(ReactRouter.withRouter(WidgetCard)))
);

const ErrorCard = styled(Placeholder)`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.alert.error.backgroundLight};
  border: 1px solid ${p => p.theme.alert.error.border};
  color: ${p => p.theme.alert.error.textLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
`;

const WidgetHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
  width: 100%;
`;

const StyledPanelBody = styled(PanelBody)`
  height: 250px;
`;
