import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getUnavailableFilterKeys} from 'sentry/views/explore/metrics/hooks/useUnavailableMetricFilterKeys';
import type {TraceItemAttribute} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

function attribute(
  key: string,
  overrides: Partial<TraceItemAttribute> = {}
): TraceItemAttribute {
  return {
    key,
    name: key,
    attributeType: 'string',
    attributeSource: {source_type: 'user'},
    ...overrides,
  };
}

function response(
  attributes: TraceItemAttribute[],
  link?: string
): ApiResponse<TraceItemAttribute[]> {
  return {headers: {Link: link}, json: attributes};
}

describe('getUnavailableFilterKeys', () => {
  it('returns keys the metric does not have', () => {
    expect(
      getUnavailableFilterKeys(
        'mode:fast environment:prod',
        response([attribute('environment')])
      )
    ).toEqual(['mode']);
  });

  it('keeps keys the metric has', () => {
    expect(
      getUnavailableFilterKeys(
        'mode:fast !region:us (env:prod OR env:dev)',
        response([attribute('mode'), attribute('region'), attribute('env')])
      )
    ).toEqual([]);
  });

  it('matches explicitly typed keys by attribute name', () => {
    expect(
      getUnavailableFilterKeys(
        'tags[count,number]:>1 tags[mode,string]:fast',
        response([attribute('tags[count,number]', {attributeType: 'number'})])
      )
    ).toEqual(['tags[mode,string]']);
  });

  it('matches secondary aliases', () => {
    expect(
      getUnavailableFilterKeys(
        'old.mode:fast',
        response([attribute('mode', {secondaryAliases: ['old.mode']})])
      )
    ).toEqual([]);
  });

  it('ignores dataset fields, sentry attributes, and has filters', () => {
    expect(
      getUnavailableFilterKeys(
        'project:foo trace:abc sentry.foo:bar has:mode free text',
        response([])
      )
    ).toEqual([]);
  });

  it('skips validation when the attribute list is truncated', () => {
    expect(
      getUnavailableFilterKeys(
        'mode:fast',
        response(
          [],
          '<https://sentry.io/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
            '<https://sentry.io/?cursor=0:1000:0>; rel="next"; results="true"; cursor="0:1000:0"'
        )
      )
    ).toEqual([]);
  });
});
