import {AxisOption} from '../../data';

export function getAxisOrBackupAxis(axis: AxisOption, axisBackupDepth?: number) {
  const displayedAxis = axisBackupDepth
    ? getBackupAxisOptions(axis, axisBackupDepth) || axis
    : axis;
  return displayedAxis;
}

export function getBackupAxisOptions(axis: AxisOption, depth: number) {
  if (depth === 0) {
    return axis;
  }
  if (!axis.backupOption) {
    return null;
  }
  return getBackupAxisOptions(axis.backupOption, depth - 1);
}

export function getBackupAxes(axes: AxisOption[], depth: number) {
  return axes.map(axis => getBackupAxisOptions(axis, depth) || axis);
}

export function getBackupFields(axis: AxisOption, maxFields = 20) {
  const fields: string[] = [];

  function _getBackupFields(_axis: AxisOption): string[] {
    if (fields.length === maxFields) {
      return fields;
    }

    if (!_axis.backupOption) {
      return fields;
    }

    fields.push(_axis.backupOption.field);
    return _getBackupFields(_axis.backupOption);
  }

  return _getBackupFields(axis);
}

export function getFieldOrBackup(
  field: string,
  backupFields?: string[],
  backupDepth?: number
) {
  return backupDepth && backupFields ? backupFields[backupDepth - 1] : field;
}
