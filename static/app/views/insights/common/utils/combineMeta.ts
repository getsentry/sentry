import type {EventsMetaType} from 'sentry/utils/discover/eventView';

export const combineMeta = (
  ...metas: Array<EventsMetaType | undefined>
): EventsMetaType | undefined => {
  const definedMetas = metas.filter(meta => meta !== undefined);

  if (definedMetas.length === 0) {
    return undefined;
  }

  const finalMeta: EventsMetaType = {
    fields: {},
    units: {},
  };

  definedMetas.forEach(meta => {
    finalMeta.fields = {...finalMeta.fields, ...meta.fields};
    finalMeta.units = {...finalMeta.units, ...meta.units};
  });

  return finalMeta;
};
