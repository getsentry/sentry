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
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconDelete, IconEdit, IconGrabbable, IconWarning} from 'app/icons';
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

import {ChartContainer, HeaderTitleLegend} from '../performance/styles';

import {Widget} from './types';
import WidgetQueries from './widgetQueries';

type Props = ReactRouter.WithRouterProps & {
  api: Client;
  organization: Organization;
  isEditing: boolean;
  widget: Widget;
  selection: GlobalSelection;
  onDelete: () => void;
  onEdit: () => void;
  renderErrorMessage?: (errorMessage: string | undefined) => React.ReactNode;
  isDragging: boolean;
  hideToolbar?: boolean;
  startWidgetDrag: (
    event: React.MouseEvent<SVGElement> | React.TouchEvent<SVGElement>
  ) => void;
};

class WidgetCard extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props): boolean {
    if (
      !isEqual(nextProps.widget, this.props.widget) ||
      !isEqual(nextProps.selection, this.props.selection) ||
      this.props.isEditing !== nextProps.isEditing ||
      this.props.isDragging !== nextProps.isDragging ||
      this.props.hideToolbar !== nextProps.hideToolbar
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

  renderVisual({
    results,
    errorMessage,
    loading,
  }: Pick<WidgetQueries['state'], 'results' | 'errorMessage' | 'loading'>) {
    const {location, router, selection, widget} = this.props;

    const {start, end, period} = selection.datetime;

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
        left: '0px',
        right: '0px',
        top: '40px',
        bottom: '10px',
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
      <ChartZoom router={router} period={period} start={start} end={end}>
        {zoomRenderProps => {
          if (errorMessage) {
            return (
              <ErrorPanel>
                <IconWarning color="gray500" size="lg" />
              </ErrorPanel>
            );
          }

          const colors = results ? theme.charts.getColorPalette(results.length - 2) : [];

          // Create a list of series based on the order of the fields,
          const series = results
            ? results.map((values, i: number) => ({
                ...values,
                color: colors[i],
              }))
            : [];

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
      </ChartZoom>
    );
  }

  renderToolbar() {
    if (!this.props.isEditing) {
      return null;
    }

    if (this.props.hideToolbar) {
      return <ToolbarPanel />;
    }

    const {onEdit, onDelete, startWidgetDrag} = this.props;

    return (
      <ToolbarPanel>
        <IconContainer data-component="icon-container">
          <StyledIconGrabbable
            color="gray500"
            size="lg"
            onMouseDown={event => startWidgetDrag(event)}
            onTouchStart={event => startWidgetDrag(event)}
          />
          <IconClick
            onClick={() => {
              onEdit();
            }}
          >
            <IconEdit color="gray500" size="lg" />
          </IconClick>
          <IconClick
            onClick={() => {
              onDelete();
            }}
          >
            <IconDelete color="gray500" size="lg" />
          </IconClick>
        </IconContainer>
      </ToolbarPanel>
    );
  }

  render() {
    const {
      widget,
      isDragging,
      api,
      organization,
      selection,
      renderErrorMessage,
    } = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel isDragging={isDragging}>
          <WidgetQueries
            api={api}
            organization={organization}
            widget={widget}
            selection={selection}
          >
            {({results, errorMessage, loading}) => {
              return (
                <React.Fragment>
                  {typeof renderErrorMessage === 'function'
                    ? renderErrorMessage(errorMessage)
                    : null}
                  <ChartContainer>
                    <HeaderTitleLegend>{widget.title}</HeaderTitleLegend>
                    {this.renderVisual({results, errorMessage, loading})}
                    {this.renderToolbar()}
                  </ChartContainer>
                </React.Fragment>
              );
            }}
          </WidgetQueries>
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

const StyledPanel = styled(Panel)<{isDragging: boolean}>`
  margin: 0;
  visibility: ${p => (p.isDragging ? 'hidden' : 'visible')};
`;

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: center;
  align-items: center;

  background-color: rgba(255, 255, 255, 0.5);
`;

const IconContainer = styled('div')`
  display: flex;

  > * + * {
    margin-left: 50px;
  }
`;

const IconClick = styled('div')`
  &:hover {
    cursor: pointer;
  }
`;

const StyledIconGrabbable = styled(IconGrabbable)`
  &:hover {
    cursor: grab;
  }
`;
