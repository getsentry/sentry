import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameVariablesTree} from './frameVariablesTree';
import {getJsonFrameVariables} from './getJsonFrameVariables';

it('opens small collections two levels deep and keeps larger collections collapsed', async () => {
  render(
    <FrameVariablesTree
      platform="node"
      variables={getJsonFrameVariables(
        {
          player: {inventory: {items: [42]}},
          small_array: [1, 2, 3, 4, 5],
          large_array: [1, 2, 3, 4, 5, 6],
          large_object: {child: {hidden: 'secret'}, a: 1, b: 2, c: 3, d: 4, e: 5},
          truncated: [7],
        },
        {truncated: {'': {len: 6}}}
      )}
    />
  );

  expect(screen.getByRole('button', {name: 'Collapse player'})).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  expect(screen.getByRole('button', {name: 'Collapse inventory'})).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(screen.queryByText('42')).not.toBeInTheDocument();
  for (const name of ['items', 'large_array', 'large_object', 'truncated']) {
    expect(
      screen.getByRole('button', {name: `Expand ${name}`, expanded: false})
    ).toBeInTheDocument();
  }

  await userEvent.click(
    screen.getByRole('button', {name: 'Expand items', expanded: false})
  );
  expect(screen.getByText('42')).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', {name: 'Expand large_object', expanded: false})
  );
  expect(screen.queryByText('secret')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', {name: 'Expand child', expanded: false})
  ).toBeInTheDocument();
});

it('expands nested variables with the keyboard and the item summary', async () => {
  render(
    <FrameVariablesTree
      defaultExpanded={['player']}
      variables={[
        {
          name: 'player',
          type: 'Player *',
          kind: 'object',
          children: [
            {
              name: 'position',
              type: 'Vec3',
              kind: 'object',
              children: [
                {name: 'x', type: 'float', kind: 'number', value: '1.5'},
                {name: 'y', type: 'float', kind: 'number', value: '-3.2'},
                {name: 'z', type: 'float', kind: 'number', value: '0.0'},
              ],
            },
          ],
        },
      ]}
    />
  );

  expect(screen.getByRole('button', {name: 'Collapse player'})).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  expect(screen.queryByText('1.5')).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('position'));
  await userEvent.click(screen.getByText('Vec3'));
  expect(screen.queryByText('1.5')).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('{ x: 1.5, y: -3.2, z: 0.0 }'));
  expect(screen.getByText('1.5')).toBeInTheDocument();
  await userEvent.click(screen.getByText('position'));
  expect(screen.getByText('1.5')).toBeInTheDocument();
  const toggle = screen.getByRole('button', {name: 'Collapse position'});
  toggle.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByText('1.5')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', {name: 'Expand position'})[0]).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  await userEvent.click(toggle);
  expect(screen.getByText('1.5')).toBeInTheDocument();
});

it('previews short scalar values next to their names within the summary budget', () => {
  render(
    <FrameVariablesTree
      defaultExpanded={[]}
      variables={[
        {
          name: 'player',
          type: 'Player*',
          kind: 'object',
          pointerAddresses: ['0x000000016b29a450'],
          children: [
            {name: 'id', type: 'int', kind: 'number', value: '1'},
            {name: 'health', type: 'float', kind: 'number', value: '-5.5'},
            {name: 'alive', type: 'bool', kind: 'boolean', value: 'false'},
            {name: 'tag', type: 'char*', kind: 'string', value: 'Al'},
            {name: 'target', type: 'Player*', kind: 'null'},
            // Names only: no value, a long value, a nested structure.
            {name: 'status', type: 'RequestStatus', kind: 'unavailable'},
            {
              name: 'map',
              type: 'char*',
              kind: 'unformatted',
              value: '0x0000000104b64b33',
            },
            {
              name: 'position',
              type: 'Vec3',
              kind: 'object',
              children: [{name: 'x', type: 'double', kind: 'number', value: '102'}],
            },
            {name: 'inventory_count', type: 'size_t', kind: 'number', value: '5'},
          ],
        },
      ]}
    />
  );

  expect(
    screen.getByText(
      '{ id: 1, health: -5.5, alive: false, tag: "Al", target: nullptr, +4 more }'
    )
  ).toBeInTheDocument();
});

it('previews names without values that are long, redacted or trimmed', () => {
  render(
    <FrameVariablesTree
      defaultExpanded={[]}
      platform="node"
      variables={getJsonFrameVariables(
        {
          request: {
            id: 7,
            token: '[Filtered]',
            url: 'https://example.com/a/long/path',
            message: 'Captured...',
          },
        },
        {
          request: {
            token: {'': {rem: [['project:0', 's']]}},
            message: {'': {len: 128, rem: [['!limit', 'x']]}},
          },
        }
      )}
    />
  );

  expect(screen.getByText('{ id: 7, message, token, url }')).toBeInTheDocument();
});

it('counts unshown keys, including truncated object entries', () => {
  render(
    <FrameVariablesTree
      defaultExpanded={[]}
      variables={getJsonFrameVariables(
        {
          position: {x: 1, y: 2, z: 3},
          allocator: {
            allocated: 0,
            available: 0,
            capacity: 0,
            count: 0,
            remaining: 0,
            reserved: 0,
          },
        },
        {position: {'': {len: 5}}}
      )}
    />
  );

  expect(screen.getByText('{ x: 1, y: 2, z: 3, +2 more }')).toBeInTheDocument();
  expect(
    screen.getByText(
      '{ allocated: 0, available: 0, capacity: 0, count: 0, remaining: 0, +1 more }'
    )
  ).toBeInTheDocument();
});

it('keeps empty objects and arrays static', () => {
  render(
    <FrameVariablesTree variables={getJsonFrameVariables({object: {}, array: []})} />
  );

  expect(screen.getByText('[ 0 items ]')).toBeInTheDocument();
  expect(screen.getByText('{}')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /Expand/})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /Copy/})).not.toBeInTheDocument();
});

it('counts truncated children and hides the truncation note when collapsed', async () => {
  render(
    <FrameVariablesTree
      defaultExpanded={[]}
      variables={getJsonFrameVariables({items: [42, 7]}, {items: {'': {len: 5}}})}
    />
  );

  expect(screen.getByText('[ 5 items ]')).toBeInTheDocument();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('[ 5 items ]'));
  expect(screen.getByText('42')).toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent('(3 items truncated)');
  await userEvent.click(screen.getByRole('button', {name: 'Collapse items'}));
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

it('explains fully omitted objects and arrays without expand controls', async () => {
  const meta = {'': {len: 4, rem: [['!limit', 'x']]}};
  render(
    <FrameVariablesTree
      variables={getJsonFrameVariables(
        {array: [], object: {}},
        {array: meta, object: meta}
      )}
    />
  );

  expect(screen.getByText('[ Omitted (4 items) ]')).toBeInTheDocument();
  expect(screen.getByText('{ Omitted (4 items) }')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /Expand/})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /Copy/})).not.toBeInTheDocument();
  await userEvent.hover(screen.getByText('[ Omitted (4 items) ]'));
  expect(await screen.findByText('Removed because of size limits')).toBeInTheDocument();
});

it('displays and copies native scalars exactly without expanding collections', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {clipboard: {writeText}});
  render(
    <FrameVariablesTree
      defaultExpanded={[]}
      variables={[
        {name: 'unavailable', kind: 'unavailable'},
        {name: 'null_pointer', kind: 'null'},
        {name: 'zero', kind: 'number', value: '0'},
        {
          name: 'counter',
          type: 'uint64_t',
          kind: 'number',
          value: '18446744073709551615',
        },
        {
          name: 'address',
          type: 'void *',
          kind: 'unformatted',
          value: '0xffffffffffffffff',
        },
        {
          name: 'message',
          type: 'char[32]',
          kind: 'string',
          value: 'A "quoted" string\nwith a newline',
        },
        {
          name: 'items',
          type: 'int[2]',
          kind: 'array',
          children: [
            {name: '[0]', type: 'int', kind: 'number', value: '18446744073709551615'},
            {name: '[1]', type: 'int', kind: 'number', value: '7'},
          ],
        },
      ]}
    />
  );

  for (const [name, value] of [
    ['null_pointer', 'nullptr'],
    ['zero', '0'],
    ['counter', '18446744073709551615'],
    ['address', '0xffffffffffffffff'],
    ['message', 'A "quoted" string\nwith a newline'],
  ] as const) {
    if (name !== 'message') {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', {name: `Copy ${name} value`}));
    expect(writeText).toHaveBeenLastCalledWith(value);
  }
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', {name: 'Copy unavailable value'})
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: 'Copy items value'}));
  expect(writeText).toHaveBeenLastCalledWith(
    JSON.stringify(['18446744073709551615', '7'], null, 2)
  );
  expect(screen.queryByText('[0]')).not.toBeInTheDocument();
  expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
});

it('shows the pointer chain next to the value and keeps it when a structure is expanded', async () => {
  render(
    <FrameVariablesTree
      defaultExpanded={[]}
      variables={[
        {name: 'null_player', type: 'Player*', kind: 'null'},
        {
          name: 'health_ptr',
          type: 'float*',
          kind: 'number',
          value: '-5.5',
          pointerAddresses: ['0x000000016b29a4b0'],
        },
        {
          name: 'player',
          type: 'Player**',
          kind: 'object',
          pointerAddresses: ['0x000000016b29a430', '0x000000016b29a450'],
          children: [{name: 'id', type: 'int', kind: 'number', value: '1'}],
        },
      ]}
    />
  );

  expect(screen.getByText('nullptr')).toBeInTheDocument();
  expect(screen.getByText('0x000000016b29a4b0 \u2192')).toBeInTheDocument();
  expect(
    screen.getByText('0x000000016b29a430 \u2192 0x000000016b29a450 \u2192')
  ).toBeInTheDocument();
  await userEvent.click(screen.getByText('{ id: 1 }'));
  expect(
    screen.getByText('0x000000016b29a430 \u2192 0x000000016b29a450')
  ).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();
});

it('copies available collection values while preserving displayed annotations', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {clipboard: {writeText}});
  render(
    <FrameVariablesTree
      defaultExpanded={[]}
      platform="node"
      variables={getJsonFrameVariables(
        {
          request: {
            authorization: 'Bearer original-secret',
            token: null,
            filtered: '[Filtered]',
            message: 'Captured prefix...',
            empty: null,
            enabled: false,
            items: [0, 42],
          },
        },
        {
          request: {
            authorization: {
              '': {
                rem: [['project:0', 'm']],
                chunks: [
                  {type: 'text', text: 'Bearer ', rule_id: ''},
                  {
                    type: 'redaction',
                    text: '********',
                    rule_id: 'project:0',
                    remark: 'm',
                  },
                ],
              },
            },
            token: {'': {rem: [['!config', 'x']]}},
            filtered: {'': {rem: [['project:0', 's']]}},
            message: {
              '': {
                len: 128,
                rem: [['!limit', 'x']],
                chunks: [
                  {type: 'text', text: 'Captured prefix', rule_id: ''},
                  {type: 'redaction', text: '...', rule_id: '!limit', remark: 'x'},
                ],
              },
            },
            items: {'': {len: 4}},
          },
        }
      )}
    />
  );

  const copyRequest = screen.getByRole('button', {name: 'Copy request value'});
  await userEvent.click(copyRequest);
  expect(writeText).toHaveBeenLastCalledWith(
    JSON.stringify(
      {
        authorization: 'Bearer ********',
        empty: null,
        enabled: false,
        items: [0, 42],
        message: 'Captured prefix...',
      },
      null,
      2
    )
  );
  expect(screen.queryByText('authorization')).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', {name: 'Expand request', expanded: false})
  );
  expect(copyRequest).toBeInTheDocument();
  expect(screen.getByText(/Bearer/)).toHaveTextContent('Bearer ********');
  expect(screen.getByText(/Captured prefix/)).toHaveTextContent('Captured prefix...');
  expect(screen.getByText('[Filtered]')).toBeInTheDocument();
  expect(screen.queryByText(/original-secret/)).not.toBeInTheDocument();

  for (const {name, trigger, tooltip, copied} of [
    {
      name: 'authorization',
      trigger: '********',
      tooltip: "Masked because of a data scrubbing rule in your project's settings",
      copied: 'Bearer ********',
    },
    {
      name: 'token',
      trigger: '<redacted>',
      tooltip: 'Removed because of SDK configuration',
      copied: undefined,
    },
    {
      name: 'message',
      trigger: '...',
      tooltip: 'Removed because of size limits',
      copied: 'Captured prefix...',
    },
  ]) {
    await userEvent.hover(screen.getByText(trigger));
    expect(await screen.findByText(tooltip)).toBeInTheDocument();
    await userEvent.unhover(screen.getByText(trigger));
    if (copied === undefined) {
      expect(
        screen.queryByRole('button', {name: `Copy ${name} value`})
      ).not.toBeInTheDocument();
    } else {
      await userEvent.click(screen.getByRole('button', {name: `Copy ${name} value`}));
      expect(writeText).toHaveBeenLastCalledWith(copied);
    }
  }
  expect(
    screen.queryByRole('button', {name: 'Copy filtered value'})
  ).not.toBeInTheDocument();
  const copyItems = screen.getByRole('button', {name: 'Copy items value'});
  await userEvent.click(copyItems);
  expect(writeText).toHaveBeenLastCalledWith(JSON.stringify([0, 42], null, 2));
  expect(screen.getByRole('button', {name: 'Copy enabled value'})).toBeInTheDocument();
});

it('copies available text from truncated native wire values', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {clipboard: {writeText}});
  render(
    <FrameVariablesTree
      variables={getJsonFrameVariables(
        {truncated_message: 'The request was interrupted while processing...'},
        {
          truncated_message: {
            '': {
              len: 128,
              rem: [['!limit', 'x']],
              chunks: [
                {
                  type: 'text',
                  text: 'The request was interrupted while processing',
                  rule_id: '',
                },
                {type: 'redaction', text: '...', rule_id: '!limit', remark: 'x'},
              ],
            },
          },
        },
        'native'
      )}
    />
  );

  await userEvent.click(
    screen.getByRole('button', {name: 'Copy truncated_message value'})
  );
  expect(writeText).toHaveBeenLastCalledWith(
    'The request was interrupted while processing...'
  );
});
