import {Location} from 'history';

import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';

import _Footer from '../../charts/footer';
import {AxisOption} from '../../data';
import DurationChart from '../chart/durationChart';
import HistogramChart from '../chart/histogramChart';

import {getAxisOrBackupAxis, getBackupField} from './utils';

type DisplayProps = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  axis: AxisOption;
  onFilterChange: (minValue: number, maxValue: number) => void; // only used for distribution graphs
  didReceiveMultiAxis?: (useBackup: boolean) => void;
  usingBackupAxis: boolean;
};

export function SingleAxisChart(props: DisplayProps) {
  const {
    axis,
    onFilterChange,
    eventView,
    organization,
    location,
    didReceiveMultiAxis,
    usingBackupAxis,
  } = props;

  const backupField = getBackupField(axis);

  function didReceiveMulti(dataCounts: Record<string, number>) {
    if (!didReceiveMultiAxis) {
      return;
    }
    if (dataCounts[axis.field]) {
      didReceiveMultiAxis(false);
      return;
    }
    if (backupField && dataCounts[backupField]) {
      didReceiveMultiAxis(true);
      return;
    }
  }

  const axisOrBackup = getAxisOrBackupAxis(axis, usingBackupAxis);

  return axis.isDistribution ? (
    <HistogramChart
      field={axis.field}
      eventView={eventView}
      organization={organization}
      location={location}
      onFilterChange={onFilterChange}
      title={axisOrBackup.label}
      titleTooltip={axisOrBackup.tooltip}
      didReceiveMultiAxis={didReceiveMulti}
      usingBackupAxis={usingBackupAxis}
      backupField={backupField}
    />
  ) : (
    <DurationChart
      field={axis.field}
      eventView={eventView}
      organization={organization}
      title={axisOrBackup.label}
      titleTooltip={axisOrBackup.tooltip}
      usingBackupAxis={usingBackupAxis}
      backupField={backupField}
    />
  );
}
