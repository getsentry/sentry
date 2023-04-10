import {Location} from 'history';

import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';

import _Footer from '../../charts/footer';
import {AxisOption} from '../../data';
import DurationChart from '../chart/durationChart';

import {getAxisOrBackupAxis, getBackupField} from './utils';

type DisplayProps = {
  axis: AxisOption;
  eventView: EventView;
  location: Location;
  onFilterChange: (minValue: number, maxValue: number) => void;
  organization: Organization;
  usingBackupAxis: boolean;
  // only used for distribution graphs
  didReceiveMultiAxis?: (useBackup: boolean) => void;
};

export function SingleAxisChart(props: DisplayProps) {
  const {axis, eventView, organization, usingBackupAxis} = props;

  const backupField = getBackupField(axis);

  const axisOrBackup = getAxisOrBackupAxis(axis, usingBackupAxis);

  return (
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
