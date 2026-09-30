import {getJsonFrameVariables} from 'sentry/components/stackTrace/frame/getJsonFrameVariables';

it('sorts variables and preserves scalar kinds and nested annotations without type labels', () => {
  const removedMeta = {rem: [['!config', 'x']]};
  const arrayMeta = {len: 4, rem: [['!limit', 'x']]};
  const data = {
    player: {active: false, token: null, name: 'Alice'},
    enabled: true,
    count: 42,
    empty: null,
    items: ['[Filtered]'],
  };
  const meta = {
    player: {token: {'': removedMeta}},
    items: {'': arrayMeta, '0': {'': {rem: [['project:0', 's']]}}},
  };
  const variables = getJsonFrameVariables(data, meta);

  expect(variables).toStrictEqual([
    {name: 'count', kind: 'number', value: '42', meta: undefined},
    {name: 'empty', kind: 'null', meta: undefined},
    {
      name: 'enabled',
      kind: 'boolean',
      value: 'true',
      meta: undefined,
    },
    {
      name: 'items',
      kind: 'array',
      meta: arrayMeta,
      children: [
        {name: '[0]', kind: 'string', value: '[Filtered]', meta: meta.items['0']['']},
      ],
    },
    {
      name: 'player',
      kind: 'object',
      meta: undefined,
      children: [
        {name: 'active', kind: 'boolean', value: 'false', meta: undefined},
        {name: 'name', kind: 'string', value: 'Alice', meta: undefined},
        {name: 'token', kind: 'null', meta: removedMeta},
      ],
    },
  ]);
});

it('keeps empty objects and arrays distinct and tolerates invalid annotation entries', () => {
  expect(
    getJsonFrameVariables(
      {array: [], object: {}, missing: undefined},
      {array: null, object: 'invalid'}
    )
  ).toEqual([
    {name: 'array', kind: 'array', children: [], meta: undefined},
    {name: 'missing', kind: 'unavailable', meta: undefined},
    {name: 'object', kind: 'object', children: [], meta: undefined},
  ]);
});
