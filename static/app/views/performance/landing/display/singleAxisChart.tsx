import {Location} from 'history';

import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';

import _Footer from '../../charts/footer';
import {AxisOption} from '../../data';
import DurationChart from '../chart/durationChart';
import HistogramChart from '../chart/histogramChart';

import {getAxisOrBackupAxis, getBackupFields} from './utils';

type DisplayProps = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  axis: AxisOption;
  onFilterChange: (minValue: number, maxValue: number) => void; // only used for distribution graphs
  didReceiveMultiAxis?: (axisDepth: number) => void;
  axisBackupDepth?: number;
};

export function SingleAxisChart(props: DisplayProps) {
  const {
    axis,
    onFilterChange,
    eventView,
    organization,
    location,
    didReceiveMultiAxis,
    axisBackupDepth,
  } = props;

  const backupFields = getBackupFields(axis);

  function didReceiveMulti(dataCounts: Record<string, number>) {
    if (!didReceiveMultiAxis) {
      return;
    }
    const allFields = [axis.field, ...backupFields];
    for (const [index, field] of allFields.entries()) {
      if (dataCounts[field]) {
        didReceiveMultiAxis(index);
        return;
      }
    }
  }

  const axisOrBackup = getAxisOrBackupAxis(axis, axisBackupDepth);

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
      backupFields={backupFields}
      backupDepth={axisBackupDepth}
    />
  ) : (
    <DurationChart
      field={axis.field}
      eventView={eventView}
      organization={organization}
      title={axisOrBackup.label}
      titleTooltip={axisOrBackup.tooltip}
      backupFields={backupFields}
      backupDepth={axisBackupDepth}
    />
  );
}
