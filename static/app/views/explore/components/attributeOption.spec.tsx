import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {
  buildAttributeOptions,
  getAttributeOptionForValue,
  getAttributeOptionValue,
} from 'sentry/views/explore/components/attributeOption';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('buildAttributeOptions', () => {
  it('matches raw saved values to typed attribute options returned by the API', () => {
    const options = buildAttributeOptions({
      booleanTags: {
        'tags[span.is_segment,boolean]': {
          key: 'tags[span.is_segment,boolean]',
          name: 'span.is_segment',
          kind: FieldKind.BOOLEAN,
        },
      },
      numberTags: {
        'tags[custom.duration,number]': {
          key: 'tags[custom.duration,number]',
          name: 'custom.duration',
          kind: FieldKind.MEASUREMENT,
        },
      },
      stringTags: {},
      traceItemType: TraceItemDataset.SPANS,
    });

    expect(getAttributeOptionForValue(options, 'custom.duration')?.value).toBe(
      'tags[custom.duration,number]'
    );
    expect(getAttributeOptionValue(options, 'span.is_segment')).toBe(
      'tags[span.is_segment,boolean]'
    );
  });

  it('does not synthesize typed option values for raw attributes', () => {
    const options = buildAttributeOptions({
      booleanTags: {
        'span.is_segment': {
          key: 'span.is_segment',
          name: 'span.is_segment',
          kind: FieldKind.BOOLEAN,
        },
      },
      numberTags: {
        'custom.duration': {
          key: 'custom.duration',
          name: 'custom.duration',
          kind: FieldKind.MEASUREMENT,
        },
      },
      stringTags: {},
      traceItemType: TraceItemDataset.SPANS,
    });

    expect(options.map(option => option.value)).toEqual([
      'custom.duration',
      'span.is_segment',
    ]);
  });

  it('matches typed saved string values to raw string options', () => {
    const options = buildAttributeOptions({
      booleanTags: {},
      numberTags: {},
      stringTags: {
        'span.op': {
          key: 'span.op',
          name: 'span.op',
          kind: FieldKind.TAG,
        },
      },
      traceItemType: TraceItemDataset.SPANS,
    });

    expect(getAttributeOptionForValue(options, 'tags[span.op,string]')?.value).toBe(
      'span.op'
    );
  });

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
      'custom.duration',
      'span.op',
      'span.is_segment',
    ]);
  });
});
