import {AxisOption} from '../../data';

export function getAxisOrBackupAxis(axis: AxisOption, usingBackupAxis: boolean) {
  const displayedAxis = usingBackupAxis ? getBackupAxisOption(axis) ?? axis : axis;
  return displayedAxis;
}

export function getBackupAxisOption(axis: AxisOption) {
  return axis.backupOption;
}

export function getBackupAxes(axes: AxisOption[], usingBackupAxis: boolean) {
  return usingBackupAxis ? axes.map(axis => getBackupAxisOption(axis) ?? axis) : axes;
}

export function getBackupField(axis: AxisOption) {
  const backupOption = getBackupAxisOption(axis);

  if (!backupOption) {
    return undefined;
  }

  return backupOption.field;
}

export function getFieldOrBackup(field: string, backupField?: string) {
  return backupField ?? field;
}
