import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';

import _Footer from '../../charts/footer';
import {AxisOption} from '../../data';
import DurationChart from '../chart/durationChart';
import HistogramChart from '../chart/histogramChart';

type DisplayProps = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  axis: AxisOption;
  onFilterChange: (minValue: number, maxValue: number) => void; // only used for distribution graphs
};

export function SingleAxisChart(props: DisplayProps) {
  const {axis, onFilterChange, eventView, organization} = props;
  return axis.isDistribution ? (
    <HistogramChart
      field={axis.field}
      {...props}
      onFilterChange={onFilterChange}
      title={axis.label}
      titleTooltip={axis.tooltip}
    />
  ) : (
    <DurationChart
      field={axis.field}
      eventView={eventView}
      organization={organization}
      title={axis.label}
      titleTooltip={axis.tooltip}
    />
  );
}
