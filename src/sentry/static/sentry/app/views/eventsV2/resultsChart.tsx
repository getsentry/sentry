import React from 'react';
import styled from '@emotion/styled';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {Organization} from 'app/types';

import {Panel} from 'app/components/panels';
import getDynamicText from 'app/utils/getDynamicText';
import EventsChart from 'app/views/events/eventsChart';

import ChartFooter, {TooltipData} from './chartFooter';
import EventView from './eventView';

const defaultTooltip: TooltipData = {
  values: [],
  timestamp: 0,
};

type Props = {
  router: ReactRouter.InjectedRouter;
  organization: Organization;
  eventView: EventView;
  location: Location;

  total: number | null;
  onAxisChange: (value: string) => void;
};

type State = {
  tooltipData: TooltipData;
};

export default class ResultsChart extends React.Component<Props, State> {
  state = {
    tooltipData: defaultTooltip,
  };

  handleTooltipUpdate = (state: TooltipData) => {
    this.setState({tooltipData: state});
  };

  render() {
    const {eventView, location, organization, router, total, onAxisChange} = this.props;

    const yAxisValue = eventView.getYAxis();

    return (
      <StyledPanel onMouseLeave={() => this.handleTooltipUpdate(defaultTooltip)}>
        {getDynamicText({
          value: (
            <EventsChart
              router={router}
              query={eventView.getEventsAPIPayload(location).query}
              organization={organization}
              showLegend
              yAxis={yAxisValue}
              project={eventView.project as number[]}
              environment={eventView.environment as string[]}
              onTooltipUpdate={this.handleTooltipUpdate}
            />
          ),
          fixed: 'events chart',
        })}
        <ChartFooter
          hoverState={this.state.tooltipData}
          total={total}
          yAxisValue={yAxisValue}
          yAxisOptions={eventView.getYAxisOptions()}
          onChange={onAxisChange}
        />
      </StyledPanel>
    );
  }
}

export const StyledPanel = styled(Panel)`
  .echarts-for-react div:first-child {
    width: 100% !important;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin: 0;
  }
`;
