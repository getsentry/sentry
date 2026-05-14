import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {makeTestQueryClient} from 'sentry-test/queryClient';

import {FieldKind} from 'sentry/utils/fields';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  getTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

type Attribute = {
  attributeSource: {
    source_type: string;
  };
  attributeType: 'boolean' | 'number' | 'string';
  key: string;
  name: string;
};

type ScopedCase = {
  fetchOverrides: Partial<Parameters<typeof traceItemAttributeKeysOptions>[0]>;
  name: string;
  query: Record<string, unknown>;
};

function makeAttribute(
  key: string,
  attributeType: Attribute['attributeType'] = 'string'
): Attribute {
  return {
    attributeSource: {source_type: 'custom'},
    attributeType,
    key,
    name: key,
  };
}

describe('traceItemAttributeKeysOptions', () => {
  const organization = OrganizationFixture();
  const queryClient = makeTestQueryClient();
  const endpoint = `/organizations/${organization.slug}/trace-items/attributes/`;
  const selection = PageFiltersFixture({
    datetime: {
      end: null,
      period: '7d',
      start: null,
      utc: null,
    },
    projects: [1],
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    queryClient.clear();
  });

  function addAttributeKeysMock({
    body,
    query = {},
    substringMatch,
  }: {
    body: Attribute[];
    substringMatch: string;
    query?: Record<string, unknown>;
  }) {
    return MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body,
      match: [
        MockApiClient.matchQuery({
          attributeType: ['string', 'number', 'boolean'],
          itemType: TraceItemDataset.LOGS,
          project: ['1'],
          statsPeriod: '7d',
          substringMatch,
          ...query,
        }),
      ],
    });
  }

  function fetchAttributeKeys({
    search,
    ...overrides
  }: Partial<Parameters<typeof traceItemAttributeKeysOptions>[0]> & {search: string}) {
    return queryClient.fetchQuery(
      traceItemAttributeKeysOptions({
        organization,
        selection,
        staleTime: 10_000,
        traceItemType: TraceItemDataset.LOGS,
        search,
        ...overrides,
      })
    );
  }

  it('reuses a fresh cached empty response from a shorter prefix', async () => {
    const prefixRequest = addAttributeKeysMock({substringMatch: 'fo', body: []});
    const longerRequest = addAttributeKeysMock({
      substringMatch: 'foo',
      body: [makeAttribute('foo.bar')],
    });

    const prefixResult = await fetchAttributeKeys({search: 'fo'});
    const longerResult = await fetchAttributeKeys({search: 'foo'});

    expect(prefixResult.json).toEqual([]);
    expect(longerResult.json).toEqual([]);
    expect(prefixRequest).toHaveBeenCalledTimes(1);
    expect(longerRequest).not.toHaveBeenCalled();
  });

  it('does not reuse non-empty cached prefix results', async () => {
    const prefixBody = [makeAttribute('foo')];
    const longerBody = [makeAttribute('foo.bar')];
    const prefixRequest = addAttributeKeysMock({
      substringMatch: 'fo',
      body: prefixBody,
    });
    const longerRequest = addAttributeKeysMock({
      substringMatch: 'foo',
      body: longerBody,
    });

    const prefixResult = await fetchAttributeKeys({search: 'fo'});
    const longerResult = await fetchAttributeKeys({search: 'foo'});

    expect(prefixResult.json).toEqual(prefixBody);
    expect(longerResult.json).toEqual(longerBody);
    expect(prefixRequest).toHaveBeenCalledTimes(1);
    expect(longerRequest).toHaveBeenCalledTimes(1);
  });

  it('scopes cache reuse to otherwise-identical query options', async () => {
    addAttributeKeysMock({substringMatch: 'fo', body: []});
    await fetchAttributeKeys({search: 'fo'});

    const scopedCases: ScopedCase[] = [
      {
        name: 'query',
        query: {query: 'severity:error'},
        fetchOverrides: {query: 'severity:error'},
      },
      {
        name: 'type',
        query: {attributeType: 'string'},
        fetchOverrides: {type: 'string'},
      },
      {
        name: 'trace item type',
        query: {itemType: TraceItemDataset.SPANS},
        fetchOverrides: {traceItemType: TraceItemDataset.SPANS},
      },
      {
        name: 'project ids',
        query: {project: ['2']},
        fetchOverrides: {projectIds: [2]},
      },
      {
        name: 'normalized datetime params',
        query: {statsPeriod: '14d'},
        fetchOverrides: {
          selection: PageFiltersFixture({
            ...selection,
            datetime: {
              end: null,
              period: '14d',
              start: null,
              utc: null,
            },
          }),
        },
      },
    ];

    for (const scopedCase of scopedCases) {
      const longerBody = [makeAttribute(`${scopedCase.name}.match`)];
      const longerRequest = addAttributeKeysMock({
        substringMatch: 'foo',
        body: longerBody,
        query: scopedCase.query,
      });

      const longerResult = await fetchAttributeKeys({
        search: 'foo',
        ...scopedCase.fetchOverrides,
      });

      expect(longerResult.json).toEqual(longerBody);
      expect(longerRequest).toHaveBeenCalledTimes(1);
    }
  });

  it('ignores stale empty prefix results', async () => {
    const prefixOptions = traceItemAttributeKeysOptions({
      organization,
      selection,
      staleTime: 10_000,
      traceItemType: TraceItemDataset.LOGS,
      search: 'fo',
    });
    const prefixRequest = addAttributeKeysMock({substringMatch: 'fo', body: []});

    await queryClient.fetchQuery(prefixOptions);
    await queryClient.invalidateQueries({queryKey: prefixOptions.queryKey});

    const longerBody = [makeAttribute('foo.bar')];
    const longerRequest = addAttributeKeysMock({
      substringMatch: 'foo',
      body: longerBody,
    });

    const longerResult = await fetchAttributeKeys({search: 'foo'});

    expect(longerResult.json).toEqual(longerBody);
    expect(prefixRequest).toHaveBeenCalledTimes(1);
    expect(longerRequest).toHaveBeenCalledTimes(1);
  });

  it('does not use the cache shortcut without a valid shorter prefix', async () => {
    const cachedRequest = addAttributeKeysMock({substringMatch: 'bar', body: []});
    const currentBody = [makeAttribute('foo.bar')];
    const currentRequest = addAttributeKeysMock({
      substringMatch: 'foo',
      body: currentBody,
    });

    await fetchAttributeKeys({search: 'bar'});
    const result = await fetchAttributeKeys({search: 'foo'});

    expect(result.json).toEqual(currentBody);
    expect(cachedRequest).toHaveBeenCalledTimes(1);
    expect(currentRequest).toHaveBeenCalledTimes(1);
  });
});

describe('getTraceItemTagCollection', () => {
  it('preserves plain tags with @ in the tag name', () => {
    const key = 'custom.metric@primary';

    expect(getTraceItemTagCollection([makeAttribute(key, 'number')], 'number')).toEqual({
      [key]: {
        key,
        name: key,
        kind: FieldKind.MEASUREMENT,
        secondaryAliases: [],
      },
    });
  });

  it('preserves wrapped number tags with @ in the tag name', () => {
    const key = 'tags[custom.metric@primary,number]';

    expect(getTraceItemTagCollection([makeAttribute(key, 'number')], 'number')).toEqual({
      [key]: {
        key,
        name: key,
        kind: FieldKind.MEASUREMENT,
        secondaryAliases: [],
      },
    });
  });
});
