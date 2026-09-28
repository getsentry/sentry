import {getSpanLinkType, parseSpanLinks} from 'sentry/views/explore/tables/spanLinks';

describe('parseSpanLinks', () => {
  const link = {
    trace_id: 'd099bf9ad5a143cf8f83a98081d0ed3b',
    span_id: '8873a98879faf06d',
    sampled: true,
    attributes: {'sentry.link.type': 'previous_trace'},
  };

  it('parses a JSON array of links', () => {
    expect(parseSpanLinks(JSON.stringify([link]))).toEqual([link]);
  });

  it.each([
    ['null', null],
    ['an empty string', ''],
    ['a number', 12],
    ['invalid JSON', '[{'],
    ['a JSON object', '{"span_id": "abc"}'],
    ['an array with an entry that is not a link', '[{"trace_id": "abc"}]'],
  ])('returns null for %s', (_label, value) => {
    expect(parseSpanLinks(value)).toBeNull();
  });
});

describe('getSpanLinkType', () => {
  const base = {trace_id: 'trace', span_id: 'span'};

  it('reads a plain string attribute', () => {
    expect(
      getSpanLinkType({...base, attributes: {'sentry.link.type': 'previous_trace'}})
    ).toBe('previous_trace');
  });

  it('reads a typed attribute value', () => {
    expect(
      getSpanLinkType({
        ...base,
        attributes: {'sentry.link.type': {type: 'string', value: 'next_trace'}},
      })
    ).toBe('next_trace');
  });

  it('returns undefined when the type is missing', () => {
    expect(getSpanLinkType(base)).toBeUndefined();
    expect(
      getSpanLinkType({...base, attributes: {'sentry.link.type': 7}})
    ).toBeUndefined();
  });
});
