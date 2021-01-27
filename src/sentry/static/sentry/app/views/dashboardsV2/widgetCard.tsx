import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import ChartZoom from 'app/components/charts/chartZoom';
import Legend from 'app/components/charts/components/legend';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import SimpleTableChart from 'app/components/charts/simpleTableChart';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getSeriesSelection} from 'app/components/charts/utils';
import WorldMapChart from 'app/components/charts/worldMapChart';
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

import {HeaderTitle} from '../performance/styles';

import {Widget} from './types';
import WidgetQueries from './widgetQueries';

type Props = ReactRouter.WithRouterProps & {
  api: Client;
  organization: Organization;
  location: Location;
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

type TableResultProps = Pick<
  WidgetQueries['state'],
  'errorMessage' | 'loading' | 'tableResults'
>;

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
            size="md"
            onMouseDown={event => startWidgetDrag(event)}
            onTouchStart={event => startWidgetDrag(event)}
          />
          <IconClick
            data-test-id="widget-edit"
            onClick={() => {
              onEdit();
            }}
          >
            <IconEdit color="gray500" size="md" />
          </IconClick>
          <IconClick
            data-test-id="widget-delete"
            onClick={() => {
              onDelete();
            }}
          >
            <IconDelete color="gray500" size="md" />
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
      location,
      router,
    } = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel isDragging={isDragging}>
          <WidgetTitle>{widget.title}</WidgetTitle>
          <WidgetQueries
            api={api}
            organization={organization}
            widget={widget}
            selection={selection}
          >
            {({tableResults, timeseriesResults, errorMessage, loading}) => {
              return (
                <React.Fragment>
                  {typeof renderErrorMessage === 'function'
                    ? renderErrorMessage(errorMessage)
                    : null}
                  <WidgetCardVisuals
                    timeseriesResults={timeseriesResults}
                    tableResults={tableResults}
                    errorMessage={errorMessage}
                    loading={loading}
                    location={location}
                    widget={widget}
                    selection={selection}
                    router={router}
                  />
                  {this.renderToolbar()}
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

const StyledPanel = styled(Panel, {
  shouldForwardProp: prop => prop !== 'isDragging',
})<{
  isDragging: boolean;
}>`
  margin: 0;
  visibility: ${p => (p.isDragging ? 'hidden' : 'visible')};
  /* If a panel overflows due to a long title stretch its grid sibling */
  height: 100%;
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

const WidgetTitle = styled(HeaderTitle)`
  padding: ${space(1)} ${space(2)} 0;
  width: 100%;
`;

type WidgetCardVisualsProps = Pick<ReactRouter.WithRouterProps, 'router'> &
  Pick<
    WidgetQueries['state'],
    'timeseriesResults' | 'tableResults' | 'errorMessage' | 'loading'
  > & {
    location: Location;
    widget: Widget;
    selection: GlobalSelection;
  };

class WidgetCardVisuals extends React.Component<WidgetCardVisualsProps> {
  shouldComponentUpdate(nextProps: WidgetCardVisualsProps): boolean {
    // Widget title changes should not update the WidgetCardVisuals component tree
    const currentProps = {
      ...this.props,
      widget: {
        ...this.props.widget,
        title: '',
      },
    };

    nextProps = {
      ...nextProps,
      widget: {
        ...nextProps.widget,
        title: '',
      },
    };

    return !isEqual(currentProps, nextProps);
  }

  tableResultComponent({
    loading,
    errorMessage,
    tableResults,
  }: TableResultProps): React.ReactNode {
    const {location, widget} = this.props;
    if (errorMessage) {
      return (
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      );
    }

    if (typeof tableResults === 'undefined' || loading) {
      // Align height to other charts.
      return <Placeholder height="200px" />;
    }

    return tableResults.map((result, i) => {
      const fields = widget.queries[i]?.fields ?? [];
      return (
        <SimpleTableChart
          key={`table:${result.title}`}
          location={location}
          fields={fields}
          title={tableResults.length > 1 ? result.title : ''}
          loading={loading}
          metadata={result.meta}
          data={result.data}
        />
      );
    });
  }

  chartComponent(chartProps): React.ReactNode {
    const {widget} = this.props;

    switch (widget.displayType) {
      case 'bar':
        return <BarChart {...chartProps} />;
      case 'area':
        return <AreaChart stacked {...chartProps} />;
      case 'world_map':
        return <WorldMapChart {...chartProps} />;
      case 'line':
      default:
        return <LineChart {...chartProps} />;
    }
  }

  render() {
    const {tableResults, timeseriesResults, errorMessage, loading, widget} = this.props;

    if (widget.displayType === 'table') {
      return (
        <TransitionChart loading={loading} reloading={loading}>
          <TransparentLoadingMask visible={loading} />
          {this.tableResultComponent({tableResults, loading, errorMessage})}
        </TransitionChart>
      );
    }

    if (errorMessage) {
      return (
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      );
    }

    const {location, router, selection} = this.props;
    const {start, end, period} = selection.datetime;

    if (widget.displayType === 'world_map') {
      const DEFAULT_GEO_DATA = {
        title: '',
        data: [],
      };

      const processTableResults = () => {
        if (!tableResults || !tableResults.length) {
          return DEFAULT_GEO_DATA;
        }

        const tableResult = tableResults[0];

        const {data, meta} = tableResult;

        if (!data || !data.length || !meta) {
          return DEFAULT_GEO_DATA;
        }

        const preAggregate = Object.keys(meta).find(column => {
          return column !== 'geo.country_code';
        });

        if (!preAggregate) {
          return DEFAULT_GEO_DATA;
        }

        return {
          title: tableResult.title ?? '',
          data: data.map(row => {
            return {name: row['geo.country_code'] ?? '', value: row[preAggregate]};
          }),
        };
      };

      const {data, title} = processTableResults();

      const series = [
        {
          seriesName: title,
          data,
        },
      ];

      return (
        <TransitionChart loading={loading} reloading={loading}>
          <TransparentLoadingMask visible={loading} />
          {getDynamicText({
            value: this.chartComponent({
              series,
            }),
            fixed: 'Widget Chart',
          })}
        </TransitionChart>
      );
    }

    const legend = Legend({
      right: 10,
      top: 5,
      type: 'plain',
      selected: getSeriesSelection(location),
      theme,
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
    });

    const axisField = widget.queries[0]?.fields?.[0] ?? 'count()';
    const chartOptions = {
      grid: {
        left: space(3),
        right: space(3),
        top: space(2),
        bottom: space(3),
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

          const colors = timeseriesResults
            ? theme.charts.getColorPalette(timeseriesResults.length - 2)
            : [];

          // Create a list of series based on the order of the fields,
          const series = timeseriesResults
            ? timeseriesResults.map((values, i: number) => ({
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
}
