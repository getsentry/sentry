import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {buildAttributeOptions} from 'sentry/views/explore/components/attributeOption';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('buildAttributeOptions', () => {
  it('deduplicates typed extra columns against raw tag collection keys', () => {
    const stringTags: TagCollection = {
      'span.op': {
        key: 'span.op',
        name: 'span.op',
        kind: FieldKind.TAG,
      },
    };
    const numberTags: TagCollection = {
      'custom.duration': {
        key: 'custom.duration',
        name: 'custom.duration',
        kind: FieldKind.MEASUREMENT,
      },
    };
    const booleanTags: TagCollection = {
      'span.is_segment': {
        key: 'span.is_segment',
        name: 'span.is_segment',
        kind: FieldKind.BOOLEAN,
      },
    };

    const options = buildAttributeOptions({
      booleanTags,
      numberTags,
      stringTags,
      traceItemType: TraceItemDataset.SPANS,
      extraColumns: [
        'tags[span.op,string]',
        'tags[custom.duration,number]',
        'tags[span.is_segment,boolean]',
      ],
    });

    expect(options.map(option => option.value)).toEqual([
      'tags[custom.duration,number]',
      'span.op',
      'tags[span.is_segment,boolean]',
    ]);
  });
});
