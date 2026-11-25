import {getFrameVariableCopyText} from './getFrameVariableCopyText';
import {getJsonFrameVariables} from './getJsonFrameVariables';

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
    {name: 'enabled', kind: 'boolean', value: 'true', meta: undefined},
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

it('preserves empty collections in parent copies without including omitted collections', () => {
  const [variable] = getJsonFrameVariables(
    {payload: {empty_array: [], empty_object: {}, items: [[], {}, 1], omitted: []}},
    {payload: {omitted: {'': {len: 4, rem: [['!limit', 'x']]}}}}
  );

  expect(getFrameVariableCopyText(variable!, 'node')).toBe(
    JSON.stringify({empty_array: [], empty_object: {}, items: [[], {}, 1]}, null, 2)
  );
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

describe('native variables extracted by Symbolicator', () => {
  const convert = (value: unknown, meta?: unknown) =>
    getJsonFrameVariables({variable: value}, {variable: meta}, 'native')[0]!;

  it('converts primitives, unreadable values and bytes of an unknown encoding', () => {
    expect(convert({kind: 'parameter', type: 'int', value: 2})).toEqual({
      name: 'variable',
      type: 'int',
      kind: 'number',
      value: '2',
    });
    expect(convert({kind: 'local', type: 'bool', value: false})).toMatchObject({
      kind: 'boolean',
      value: 'false',
    });
    // Characters, integers beyond 64 bits and addresses arrive as formatted strings.
    expect(convert({kind: 'local', type: 'char', value: "'a'"})).toMatchObject({
      kind: 'unformatted',
      value: "'a'",
    });
    expect(convert({kind: 'local', type: 'RequestStatus'})).toEqual({
      name: 'variable',
      type: 'RequestStatus',
      kind: 'unavailable',
    });
    // Symbolicator sends an empty type name for types it does not support.
    expect(convert({kind: 'local', type: ''})).toEqual({
      name: 'variable',
      kind: 'unavailable',
    });
    expect(convert({kind: 'local', type: '<unknown>', value: ['0x2a', '0x00']})).toEqual({
      name: 'variable',
      type: '<unknown>',
      kind: 'array',
      children: [
        {name: '[0]', kind: 'unformatted', value: '0x2a'},
        {name: '[1]', kind: 'unformatted', value: '0x00'},
      ],
    });
  });

  it('attaches the pointer chain to the value of the final pointee', () => {
    expect(
      convert({
        kind: 'local',
        type: 'float**',
        pointer_address: ['0x000000016b29a430', '0x000000016b29a4b0'],
        value: -5.5,
      })
    ).toEqual({
      name: 'variable',
      type: 'float**',
      kind: 'number',
      value: '-5.5',
      pointerAddresses: ['0x000000016b29a430', '0x000000016b29a4b0'],
    });
    expect(
      convert({
        kind: 'parameter',
        type: 'Player*',
        pointer_address: ['0x000000016b29a450'],
        members: {
          id: {type: 'int', value: 1},
          health: {type: 'float', value: -5.5},
          inventory: {type: 'int*', pointer_address: ['0x000000016b29a540'], value: 42},
        },
      })
    ).toEqual({
      name: 'variable',
      type: 'Player*',
      kind: 'object',
      pointerAddresses: ['0x000000016b29a450'],
      // Members are not sorted again, they keep the order of the payload. On a stored
      // event that order is alphabetical, because Relay sorts the keys.
      children: [
        {name: 'id', type: 'int', kind: 'number', value: '1'},
        {name: 'health', type: 'float', kind: 'number', value: '-5.5'},
        {
          name: 'inventory',
          type: 'int*',
          kind: 'number',
          value: '42',
          pointerAddresses: ['0x000000016b29a540'],
        },
      ],
    });
  });

  it('ends the chain at an address that could not be dereferenced', () => {
    expect(
      convert({kind: 'local', type: 'Player*', pointer_address: ['0x0000000000000000']})
    ).toEqual({name: 'variable', type: 'Player*', kind: 'null'});
    expect(
      convert({
        kind: 'local',
        type: 'Player**',
        pointer_address: ['0x000000016b29a430', '0x00000000'],
      })
    ).toEqual({
      name: 'variable',
      type: 'Player**',
      kind: 'null',
      pointerAddresses: ['0x000000016b29a430'],
    });
    // The memory at a non-null address can be missing from the minidump.
    expect(
      convert({kind: 'local', type: 'char*', pointer_address: ['0x0000000104b64b33']})
    ).toEqual({
      name: 'variable',
      type: 'char*',
      kind: 'unformatted',
      value: '0x0000000104b64b33',
    });
  });

  it('flattens nested pointees sent before pointer chains were flattened', () => {
    expect(
      convert({
        kind: 'parameter',
        type: 'GameState*',
        pointer_address: '0x000000016b29a430',
        pointee: {
          type: 'GameState',
          members: {
            tick: {type: 'int', value: 1},
            players: {
              type: 'Player*',
              pointer_address: '0x000000016b29a450',
              pointee: {type: 'Player', members: {id: {type: 'int', value: 1}}},
            },
          },
        },
      })
    ).toEqual({
      name: 'variable',
      type: 'GameState*',
      kind: 'object',
      pointerAddresses: ['0x000000016b29a430'],
      children: [
        {name: 'tick', type: 'int', kind: 'number', value: '1'},
        {
          name: 'players',
          type: 'Player*',
          kind: 'object',
          pointerAddresses: ['0x000000016b29a450'],
          children: [{name: 'id', type: 'int', kind: 'number', value: '1'}],
        },
      ],
    });
  });

  it('shows values that Relay serialized at its depth limit verbatim', () => {
    const serialized = '{"type":"int","value":1}';
    expect(
      convert({
        kind: 'local',
        type: 'GameState',
        members: {
          tick: serialized,
          players: {
            type: 'Player*',
            pointer_address: '0x000000016b29a450',
            pointee: serialized,
          },
        },
      })
    ).toMatchObject({
      kind: 'object',
      children: [
        {name: 'tick', kind: 'unformatted', value: serialized},
        {
          name: 'players',
          type: 'Player*',
          kind: 'unformatted',
          value: serialized,
          pointerAddresses: ['0x000000016b29a450'],
        },
      ],
    });
  });

  it('reads annotations from the value and the members', () => {
    const removed = {rem: [['!config', 'x']]};
    const trimmed = {len: 7};
    expect(
      convert(
        {
          kind: 'local',
          type: 'Player',
          members: {token: {type: 'char*', pointer_address: ['0x1000'], value: null}},
        },
        {members: {'': trimmed, token: {value: {'': removed}}}}
      )
    ).toMatchObject({
      kind: 'object',
      meta: trimmed,
      children: [{name: 'token', kind: 'null', meta: removed}],
    });
  });

  it('reads values that lost their type to the size limit of Relay', () => {
    // Relay drops the keys after the point where a frame's variables exceed its size
    // limit, in alphabetical order: a value cut inside `members` keeps `kind` and loses
    // `pointer_address` and `type`.
    expect(
      convert(
        {
          kind: 'parameter',
          members: {
            id: {type: 'int', value: 1},
            position: {members: {x: {type: 'double', value: 102}}},
          },
        },
        {
          '': {len: 4},
          members: {'': {len: 7}, position: {'': {len: 2}, members: {'': {len: 3}}}},
        }
      )
    ).toEqual({
      name: 'variable',
      kind: 'object',
      meta: {len: 7},
      children: [
        {name: 'id', type: 'int', kind: 'number', value: '1'},
        {
          name: 'position',
          kind: 'object',
          meta: {len: 3},
          children: [{name: 'x', type: 'double', kind: 'number', value: '102'}],
        },
      ],
    });
    // A value cut inside `pointee` loses the same keys, and its pointee loses `type`.
    expect(
      convert(
        {kind: 'local', pointee: {members: {id: {type: 'int', value: 1}}}},
        {'': {len: 4}, pointee: {'': {len: 2}, members: {'': {len: 7}}}}
      )
    ).toEqual({
      name: 'variable',
      kind: 'object',
      meta: {len: 7},
      children: [{name: 'id', type: 'int', kind: 'number', value: '1'}],
    });
  });

  it('leaves variables of other platforms and legacy native strings untouched', () => {
    expect(convert('0x2a (int)')).toMatchObject({kind: 'unformatted'});
    expect(convert({kind: 'circle', radius: 2})).toMatchObject({
      kind: 'object',
      children: [{name: 'kind'}, {name: 'radius'}],
    });
    expect(
      getJsonFrameVariables({shape: {kind: 'circle', type: 'round'}}, undefined, 'node')
    ).toMatchObject([{kind: 'object'}]);
  });
});
