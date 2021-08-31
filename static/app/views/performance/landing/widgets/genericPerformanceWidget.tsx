import {FunctionComponent, ReactNode} from 'react';
import styled from '@emotion/styled';

import ErrorPanel from 'app/components/charts/errorPanel';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons/iconWarning';
import space from 'app/styles/space';
import {HistogramChildren} from 'app/utils/performance/histogram/histogramQuery';
import {DataFilter} from 'app/utils/performance/histogram/types';
import getPerformanceWidgetContainer, {
  PerformanceWidgetContainerTypes,
} from 'app/views/performance/landing/widgets/components/performanceWidgetContainer';

import {ChartDataProps} from '../chart/histogramChart';

export enum GenericPerformanceWidgetDataType {
  histogram,
}

type HeaderProps = {
  title: string;
  titleTooltip: string;
};

type BaseProps = {
  chartField: string;
  chartHeight: number;
  dataType: GenericPerformanceWidgetDataType;
  containerType: PerformanceWidgetContainerTypes;
} & HeaderProps;

type HistogramWidgetProps = BaseProps & {
  dataType: GenericPerformanceWidgetDataType.histogram;
  Query: FunctionComponent<
    HistogramChildren & {fields: string[]; dataFilter?: DataFilter}
  >;
  HeaderActions?: FunctionComponent<ChartDataProps>;
  Chart: FunctionComponent<ChartDataProps & {chartHeight: number}>;
};

function DataStateSwitch(props: {
  loading: boolean;
  errored: boolean;
  hasData: boolean;

  loadingComponent?: JSX.Element;
  errorComponent: JSX.Element;
  chartComponent: JSX.Element;
  emptyComponent: JSX.Element;
}): JSX.Element {
  if (props.loading && props.loadingComponent) {
    return props.loadingComponent;
  }
  if (props.errored) {
    return props.errorComponent;
  }
  if (!props.hasData) {
    return props.emptyComponent;
  }
  return props.chartComponent;
}

// TODO(k-fish): Remove hardcoding the grid once all the charts are in
const grid = {
  left: space(3),
  right: space(3),
  top: '25px',
  bottom: '0px',
};

function WidgetHeader(props: HeaderProps & {renderedActions: ReactNode}) {
  const {title, titleTooltip, renderedActions} = props;
  return (
    <WidgetHeaderContainer>
      <div>
        <HeaderTitleLegend>
          {title}
          <QuestionTooltip position="top" size="sm" title={titleTooltip} />
        </HeaderTitleLegend>
      </div>

      {renderedActions && (
        <HeaderActionsContainer>{renderedActions}</HeaderActionsContainer>
      )}
    </WidgetHeaderContainer>
  );
}

const WidgetHeaderContainer = styled('div')``;
const HeaderActionsContainer = styled('div')``;

function GenericPerformanceWidget(props: HistogramWidgetProps): React.ReactElement;
function GenericPerformanceWidget(props: HistogramWidgetProps) {
  const {chartField, Query, Chart, HeaderActions, chartHeight, containerType} = props;

  return (
    <Query fields={[chartField]} dataFilter="exclude_outliers">
      {results => {
        const loading = results.isLoading;
        const errored = results.error !== null;
        const chartData = results.histograms?.[chartField];

        const Container = getPerformanceWidgetContainer({
          containerType,
        });

        const childData = {
          loading,
          errored,
          chartData,
          field: chartField,
        };

        return (
          <Container>
            <WidgetHeader
              {...props}
              renderedActions={
                HeaderActions && <HeaderActions grid={grid} {...childData} />
              }
            />
            <DataStateSwitch
              {...childData}
              hasData={!!(chartData && chartData.length)}
              errorComponent={<DefaultErrorComponent chartHeight={chartHeight} />}
              chartComponent={
                <Chart {...childData} grid={grid} chartHeight={chartHeight} />
              }
              emptyComponent={<Placeholder height={`${chartHeight}px`} />}
            />
          </Container>
        );
      }}
    </Query>
  );
}

const DefaultErrorComponent = (props: {chartHeight: number}) => {
  return (
    <ErrorPanel height={`${props.chartHeight}px`}>
      <IconWarning color="gray300" size="lg" />
    </ErrorPanel>
  );
};

GenericPerformanceWidget.defaultProps = {
  containerType: 'panel',
  chartHeight: 200,
};

export default GenericPerformanceWidget;
