import React from 'react';
import styled from '@emotion/styled';
import * as ReactRouter from 'react-router';
import {Location} from 'history';
import uniqBy from 'lodash/uniqBy';

import {Organization, SelectValue} from 'app/types';

import {Panel} from 'app/components/panels';
import getDynamicText from 'app/utils/getDynamicText';
import EventsChart from 'app/views/events/eventsChart';

import ChartFooter, {TooltipData} from './chartFooter';
import EventView, {Field} from './eventView';

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

const CHART_AXIS_OPTIONS = [
  {label: 'count(id)', value: 'count(id)'},
  {label: 'count_unique(users)', value: 'count_unique(user)'},
];

export default class ResultsChart extends React.Component<Props, State> {
  state = {
    tooltipData: defaultTooltip,
  };

  handleTooltipUpdate = (state: TooltipData) => {
    this.setState({tooltipData: state});
  };

  render() {
    const {eventView, location, organization, router, total, onAxisChange} = this.props;

    // Make option set and add the default options in.
    const yAxisOptions: SelectValue<string>[] = uniqBy(
      eventView
        .getAggregateFields()
        // Exclude last_seen and latest_event as they don't produce useful graphs.
        .filter(
          (field: Field) => ['last_seen', 'latest_event'].includes(field.field) === false
        )
        .map((field: Field) => {
          return {label: field.field, value: field.field};
        })
        .concat(CHART_AXIS_OPTIONS),
      'value'
    );
    const yAxisValue = eventView.yAxis || yAxisOptions[0].value;

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
          yAxisOptions={yAxisOptions}
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
`;
