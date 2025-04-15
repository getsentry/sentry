import type {EventsMetaType} from 'sentry/utils/discover/eventView';

export const combineMeta = (
  meta1?: EventsMetaType,
  meta2?: EventsMetaType
): EventsMetaType | undefined => {
  if (!meta1 && !meta2) {
    return undefined;
  }
  if (!meta1) {
    return meta2;
  }
  if (!meta2) {
    return meta1;
  }
  return {
    fields: {...meta1.fields, ...meta2.fields},
    units: {...meta1.units, ...meta2.units},
  };
};
