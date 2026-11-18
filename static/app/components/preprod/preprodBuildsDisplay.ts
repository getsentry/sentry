import {parseAsStringEnum} from 'nuqs';

export enum PreprodBuildsDisplay {
  SIZE = 'size',
  DISTRIBUTION = 'distribution',
  SNAPSHOT = 'snapshot',
}

export const parseAsPreprodBuildsDisplay = parseAsStringEnum(
  Object.values(PreprodBuildsDisplay)
).withDefault(PreprodBuildsDisplay.SIZE);
