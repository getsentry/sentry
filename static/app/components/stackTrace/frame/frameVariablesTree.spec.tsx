import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {FrameVariablesTree} from 'sentry/components/stackTrace/frame/frameVariablesTree';
import {getJsonFrameVariables} from 'sentry/components/stackTrace/frame/getJsonFrameVariables';

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
  await userEvent.click(screen.getByText('{ 3 items · x, y, z }'));
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

it('previews whole keys within the summary budget', () => {
  render(
    <FrameVariablesTree
      defaultExpanded={[]}
      variables={getJsonFrameVariables({
        allocator: {capacity: 0, count: 0, allocated: 0, available: 0},
      })}
    />
  );

  expect(
    screen.getByText('{ 4 items · allocated, available, capacity, … }')
  ).toBeInTheDocument();
});

it.each(['object', 'array'] as const)('keeps empty %s values static', async kind => {
  render(
    <FrameVariablesTree
      defaultExpanded={['empty']}
      variables={[{name: 'empty', type: 'Container', kind, children: []}]}
    />
  );

  const summary = screen.getByText(kind === 'array' ? '[ 0 items ]' : '{ 0 items }');
  expect(screen.queryByRole('button', {name: 'Expand empty'})).not.toBeInTheDocument();
  await userEvent.click(summary);
  expect(summary).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Expand empty'})).not.toBeInTheDocument();
});

it.each(['array', 'object'] as const)(
  'counts omitted children and explains fully omitted %s values',
  async kind => {
    render(
      <FrameVariablesTree
        defaultExpanded={[]}
        variables={[
          {
            name: 'items',
            type: kind === 'array' ? 'int[5]' : 'Container',
            kind,
            children: [
              {
                name: kind === 'array' ? '[0]' : 'first',
                type: 'int',
                kind: 'number',
                value: '42',
              },
              {
                name: kind === 'array' ? '[1]' : 'second',
                type: 'int',
                kind: 'number',
                value: '7',
              },
            ],
            meta: {len: 5, rem: [['!limit', 'x']]},
          },
          {
            name: 'omitted_items',
            type: kind === 'array' ? 'int[4]' : 'Container',
            kind,
            children: [],
            meta: {len: 4, rem: [['!limit', 'x']]},
          },
        ]}
      />
    );

    const omittedSummary = screen.getByText(
      kind === 'array' ? '[ Omitted (4 items) ]' : '{ Omitted (4 items) }'
    );
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(
      screen.queryByText(kind === 'array' ? '[0]' : 'first')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Expand omitted_items'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy omitted_items value'})
    ).not.toBeInTheDocument();
    await userEvent.hover(omittedSummary);
    expect(await screen.findByText('Removed because of size limits')).toBeInTheDocument();
    await userEvent.unhover(omittedSummary);
    await userEvent.click(
      screen.getByText(kind === 'array' ? '[ 5 items ]' : '{ 5 items · first, second }')
    );
    expect(screen.getByText(kind === 'array' ? '[0]' : 'first')).toBeInTheDocument();
    const truncation = screen.getByText('(3 items truncated)');
    expect(
      within(screen.getByRole('note')).queryByRole('button')
    ).not.toBeInTheDocument();
    expect(screen.getByText('7').compareDocumentPosition(truncation)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    await userEvent.click(screen.getByRole('button', {name: 'Collapse items'}));
    expect(screen.queryByText('42')).not.toBeInTheDocument();
    expect(screen.queryByText('(3 items truncated)')).not.toBeInTheDocument();
    expect(omittedSummary).toBeInTheDocument();
  }
);

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
        {name: 'address', type: 'void *', kind: 'pointer', value: '0xffffffffffffffff'},
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
    ['unavailable', 'Unavailable'],
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
  await userEvent.click(screen.getByRole('button', {name: 'Copy items value'}));
  expect(writeText).toHaveBeenLastCalledWith(
    JSON.stringify(['18446744073709551615', '7'], null, 2)
  );
  expect(screen.queryByText('[0]')).not.toBeInTheDocument();
  expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
});

it('uses annotated values for display, tooltips, and copying collapsed subtrees', async () => {
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

  await userEvent.click(screen.getByRole('button', {name: 'Copy request value'}));
  expect(writeText).toHaveBeenLastCalledWith(
    JSON.stringify(
      {
        authorization: 'Bearer ********',
        empty: null,
        enabled: false,
        filtered: '[Filtered]',
        items: [0, 42],
        message: 'Captured prefix...',
        token: '<redacted>',
      },
      null,
      2
    )
  );
  expect(screen.queryByText('authorization')).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', {name: 'Expand request', expanded: false})
  );
  expect(screen.getByText(/Bearer/)).toHaveTextContent('Bearer ********');
  expect(screen.getByText(/Captured prefix/)).toHaveTextContent('Captured prefix...');
  expect(screen.getByText('[Filtered]')).toBeInTheDocument();
  expect(screen.queryByText(/original-secret/)).not.toBeInTheDocument();

  for (const {name, value, trigger, tooltip} of [
    {
      name: 'authorization',
      value: 'Bearer ********',
      trigger: '********',
      tooltip: "Masked because of a data scrubbing rule in your project's settings",
    },
    {
      name: 'token',
      value: '<redacted>',
      trigger: '<redacted>',
      tooltip: 'Removed because of SDK configuration',
    },
    {
      name: 'message',
      value: 'Captured prefix...',
      trigger: '...',
      tooltip: 'Removed because of size limits',
    },
  ]) {
    await userEvent.hover(screen.getByText(trigger));
    expect(await screen.findByText(tooltip)).toBeInTheDocument();
    await userEvent.unhover(screen.getByText(trigger));
    await userEvent.click(screen.getByRole('button', {name: `Copy ${name} value`}));
    expect(writeText).toHaveBeenLastCalledWith(value);
  }
});
