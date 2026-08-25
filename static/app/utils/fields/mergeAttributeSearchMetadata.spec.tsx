import {mergeAttributeSearchMetadata} from './mergeAttributeSearchMetadata';
import {FieldKind, FieldValueType} from './types';

describe('mergeAttributeSearchMetadata', () => {
  it('keeps local DATE when conventions map the overlapping key to a non-date type', () => {
    const merged = mergeAttributeSearchMetadata('http.route', {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.DATE,
    });

    expect(merged.valueType).toBe(FieldValueType.DATE);
  });
});
