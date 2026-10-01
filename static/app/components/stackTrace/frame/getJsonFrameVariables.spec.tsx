import {getFrameVariableCopyText} from 'sentry/components/stackTrace/frame/getFrameVariableCopyText';
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

it('does not copy generated placeholders when no captured values are available', () => {
  const variables = getJsonFrameVariables(
    {redacted: null, invalid: null, object: {token: null}, array: [null]},
    {
      redacted: {'': {rem: [['!config', 'x']]}},
      invalid: {'': {err: ['invalid']}},
      object: {token: {'': {rem: [['!config', 'x']]}}},
      array: {'0': {'': {rem: [['!config', 'x']]}}},
    }
  );

  for (const variable of variables) {
    expect(getFrameVariableCopyText(variable, 'node')).toBeUndefined();
  }
});

it('hides copying for entirely redacted values and collections', () => {
  const variables = getJsonFrameVariables(
    {filtered: '[Filtered]', masked: '********', object: {token: '[Filtered]'}},
    {
      filtered: {'': {rem: [['project:0', 's']]}},
      masked: {
        '': {
          rem: [['project:0', 'm']],
          chunks: [
            {type: 'text', text: '', rule_id: ''},
            {type: 'redaction', text: '********', rule_id: 'project:0'},
          ],
        },
      },
      object: {token: {'': {rem: [['project:0', 's']]}}},
    }
  );

  for (const variable of variables) {
    expect(getFrameVariableCopyText(variable, 'node')).toBeUndefined();
  }
});

// Exercise SDK conversion and copy formatting together without repeating clipboard interactions.
it.each([
  ['native', '0x2a (int)', 'unformatted', '0x2a (int)'],
  ['python', 'True', 'boolean', 'True'],
  ['python', 'None', 'null', 'None'],
  ['python', '1', 'number', '1'],
  ['python', '18446744073709551615', 'number', '18446744073709551615'],
  ['python', "'hello'", 'string', 'hello'],
  ['python', '<Client at 0x12345>', 'unformatted', '<Client at 0x12345>'],
  ['ruby', 'false', 'boolean', 'false'],
  ['ruby', 'nil', 'null', 'nil'],
  ['php', 'true', 'boolean', 'true'],
  ['php', 'null', 'null', 'null'],
  ['node', '<null>', 'null', 'null'],
  ['node', '<undefined>', 'null', 'undefined'],
] as const)('converts and copies %s value %s', (platform, value, kind, expected) => {
  const [variable] = getJsonFrameVariables({value}, undefined, platform);
  expect(variable!.kind).toBe(kind);
  expect(getFrameVariableCopyText(variable!, platform)).toBe(expected);
});

it('copies Python collections with represented scalar types and exact numeric precision', () => {
  const [variable] = getJsonFrameVariables(
    {
      values: {
        numbers: ['1', '2', '18446744073709551615', '-3.25'],
        string: "'1'",
        enabled: 'True',
        empty: 'None',
      },
    },
    undefined,
    'python'
  );

  expect(variable).toMatchObject({
    kind: 'object',
    children: [
      {name: 'empty', kind: 'null'},
      {name: 'enabled', kind: 'boolean'},
      {
        name: 'numbers',
        kind: 'array',
        children: [
          {kind: 'number', value: '1'},
          {kind: 'number', value: '2'},
          {kind: 'number', value: '18446744073709551615'},
          {kind: 'number', value: '-3.25'},
        ],
      },
      {name: 'string', kind: 'string', value: '1'},
    ],
  });
  expect(getFrameVariableCopyText(variable!, 'python')).toBe(`{
  "empty": null,
  "enabled": true,
  "numbers": [
    1,
    2,
    18446744073709551615,
    -3.25
  ],
  "string": "1"
}`);
});
