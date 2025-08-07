import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {combineMeta} from 'sentry/views/insights/common/utils/combineMeta';

describe('combineMeta', () => {
  it('should combine meta', () => {
    const meta1: EventsMetaType = {
      fields: {a: 'boolean'},
      units: {a: 'boolean'},
    };
    const meta2: EventsMetaType = {
      fields: {b: 'duration'},
      units: {b: 'millisecond'},
    };

    const combinedMeta = combineMeta(meta1, meta2);
    expect(combinedMeta).toEqual({
      fields: {a: 'boolean', b: 'duration'},
      units: {a: 'boolean', b: 'millisecond'},
    });
  });

  it('should return undefined if both meta are undefined', () => {
    const combinedMeta = combineMeta(undefined, undefined);
    expect(combinedMeta).toBeUndefined();
  });

  it('should return meta1 if meta2 is undefined', () => {
    const meta1: EventsMetaType = {
      fields: {a: 'boolean'},
      units: {a: 'boolean'},
    };
    const combinedMeta = combineMeta(meta1, undefined);
    expect(combinedMeta).toEqual(meta1);
  });

  it('should combine 3 metas', () => {
    const meta1: EventsMetaType = {
      fields: {a: 'boolean'},
      units: {a: 'boolean'},
    };
    const meta2: EventsMetaType = {
      fields: {b: 'duration'},
      units: {b: 'millisecond'},
    };
    const meta3: EventsMetaType = {
      fields: {c: 'integer'},
      units: {},
    };

    const combinedMeta = combineMeta(meta1, meta2, meta3);
    expect(combinedMeta).toEqual({
      fields: {a: 'boolean', b: 'duration', c: 'integer'},
      units: {a: 'boolean', b: 'millisecond'},
    });
  });
});
