import {useQueryState} from 'nuqs';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';

describe('parseAsStringArray', () => {
  function renderParam(query: Record<string, string | string[]>) {
    return renderHookWithProviders(() => useQueryState('project', parseAsStringArray), {
      initialRouterConfig: {location: {pathname: '/mock-pathname/', query}},
    });
  }

  it('falls back to an empty array when the param is absent', () => {
    const {result} = renderParam({});

    expect(result.current[0]).toEqual([]);
  });

  it('reads a single value as a one-item array', () => {
    const {result} = renderParam({project: '1'});

    expect(result.current[0]).toEqual(['1']);
  });

  // Sentry encodes list params as repeated keys, so this is the case that rules
  // out nuqs' parseAsArrayOf, which splits one delimited value instead.
  it('reads every value of a repeated key', () => {
    const {result} = renderParam({project: ['1', '2']});

    expect(result.current[0]).toEqual(['1', '2']);
  });
});
