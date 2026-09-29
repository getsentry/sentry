import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {NativeFrameVariables} from 'sentry/components/stackTrace/frame/nativeFrameVariables';

it('expands nested variables with the keyboard and the item summary', async () => {
  render(
    <NativeFrameVariables
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

it('keeps previews of longer keys compact', () => {
  render(
    <NativeFrameVariables
      variables={[
        {
          name: 'allocator',
          type: 'Allocator',
          kind: 'object',
          children: ['capacity', 'count', 'allocated'].map(name => ({
            name,
            type: 'int',
            kind: 'number',
            value: '0',
          })),
        },
      ]}
    />
  );

  expect(screen.getByText('{ 3 items · capacity, count, … }')).toBeInTheDocument();
});

it('summarizes arrays with brackets and shows indices only after expansion', async () => {
  render(
    <NativeFrameVariables
      variables={[
        {
          name: 'items',
          type: 'int[2]',
          kind: 'array',
          children: [
            {name: '[0]', type: 'int', kind: 'number', value: '42'},
            {name: '[1]', type: 'int', kind: 'number', value: '7'},
          ],
        },
        {name: 'empty', type: 'int[0]', kind: 'array', children: []},
      ]}
    />
  );

  expect(screen.getByText('[ 0 items ]')).toBeInTheDocument();
  expect(screen.queryByText('[0]')).not.toBeInTheDocument();
  expect(screen.queryByText('[1]')).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('[ 2 items ]'));
  expect(screen.getByText('[0]')).toBeInTheDocument();
  expect(screen.getByText('[1]')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: 'Collapse items'}));
  expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
});

it.each(['object', 'array'] as const)('keeps empty %s values static', async kind => {
  render(
    <NativeFrameVariables
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

it('keeps unavailable values distinct from null and preserves exact numbers', () => {
  render(
    <NativeFrameVariables
      variables={[
        {name: 'unavailable', type: 'int *', kind: 'unavailable'},
        {name: 'null_pointer', type: 'int *', kind: 'null'},
        {
          name: 'counter',
          type: 'uint64_t',
          kind: 'number',
          value: '18446744073709551615',
        },
        {name: 'zero', type: 'int', kind: 'number', value: '0'},
      ]}
    />
  );

  expect(screen.getByText('Unavailable')).toBeInTheDocument();
  expect(screen.getByText('nullptr')).toBeInTheDocument();
  expect(screen.getByText('18446744073709551615')).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
});

it('uses the existing redaction display and omission tooltip', async () => {
  render(
    <NativeFrameVariables
      variables={[
        {name: 'unknown', type: 'char *', kind: 'unavailable'},
        {name: 'null_pointer', type: 'char *', kind: 'null'},
        {
          name: 'sdk_omitted',
          type: 'char *',
          kind: 'unavailable',
          meta: {rem: [['!config', 'x']]},
        },
        {
          name: 'filtered',
          type: 'char *',
          kind: 'string',
          value: '[Filtered]',
          meta: {rem: [['project:0', 's']]},
        },
      ]}
    />
  );

  expect(screen.getByText('Unavailable')).toBeInTheDocument();
  expect(screen.getByText('nullptr')).toBeInTheDocument();
  expect(screen.getByText('[Filtered]')).toBeInTheDocument();
  await userEvent.hover(screen.getByText('<redacted>'));
  expect(
    await screen.findByText('Removed because of SDK configuration')
  ).toBeInTheDocument();
});

it('preserves captured string chunks and explains masking and truncation', async () => {
  render(
    <NativeFrameVariables
      variables={[
        {
          name: 'authorization',
          type: 'char[32]',
          kind: 'string',
          value: 'Bearer ********abcd',
          meta: {
            rem: [['project:0', 'm', 7, 15]],
            chunks: [
              {type: 'text', text: 'Bearer ', rule_id: ''},
              {type: 'redaction', text: '********', rule_id: 'project:0', remark: 'm'},
              {type: 'text', text: 'abcd', rule_id: ''},
            ],
          },
        },
        {
          name: 'message',
          type: 'char[128]',
          kind: 'string',
          value: 'Captured prefix...',
          meta: {
            len: 128,
            rem: [['!limit', 'x']],
            chunks: [
              {type: 'text', text: 'Captured prefix', rule_id: ''},
              {type: 'redaction', text: '...', rule_id: '!limit', remark: 'x'},
            ],
          },
        },
      ]}
    />
  );

  expect(screen.getByText(/Bearer/)).toHaveTextContent('Bearer ********abcd');
  expect(screen.getByText(/Captured prefix/)).toHaveTextContent('Captured prefix...');
  await userEvent.hover(screen.getByText('********'));
  expect(
    await screen.findByText(
      "Masked because of a data scrubbing rule in your project's settings"
    )
  ).toBeInTheDocument();
  await userEvent.unhover(screen.getByText('********'));
  await userEvent.hover(screen.getByText('...'));
  expect(await screen.findByText('Removed because of size limits')).toBeInTheDocument();
});

it.each(['array', 'object'] as const)(
  'counts omitted children and explains fully omitted %s values',
  async kind => {
    render(
      <NativeFrameVariables
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
    expect(screen.queryByText('[ 4 items ]')).not.toBeInTheDocument();
    expect(screen.queryByText('{ 4 items }')).not.toBeInTheDocument();
    expect(screen.queryByText('(4 items truncated)')).not.toBeInTheDocument();
    expect(screen.queryByText('(3 items truncated)')).not.toBeInTheDocument();
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
    expect(screen.getByText('42')).toBeInTheDocument();
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

it('copies exact native values without changing expansion', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {clipboard: {writeText}});
  render(
    <NativeFrameVariables
      variables={[
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

  await userEvent.click(screen.getByRole('button', {name: 'Copy counter value'}));
  expect(writeText).toHaveBeenLastCalledWith('18446744073709551615');
  await userEvent.click(screen.getByRole('button', {name: 'Copy address value'}));
  expect(writeText).toHaveBeenLastCalledWith('0xffffffffffffffff');
  await userEvent.click(screen.getByRole('button', {name: 'Copy message value'}));
  expect(writeText).toHaveBeenLastCalledWith('A "quoted" string\nwith a newline');
  await userEvent.click(screen.getByRole('button', {name: 'Copy items value'}));
  expect(writeText).toHaveBeenLastCalledWith(
    JSON.stringify(['18446744073709551615', '7'], null, 2)
  );
  expect(screen.queryByText('[0]')).not.toBeInTheDocument();
  expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
});

it('copies captured JSON subtrees using scrubbed chunks and native JSON values', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {clipboard: {writeText}});
  render(
    <NativeFrameVariables
      platform="node"
      variables={[
        {
          name: 'request',
          kind: 'object',
          children: [
            {
              name: 'authorization',
              kind: 'string',
              value: 'Bearer original-secret',
              meta: {
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
            {name: 'token', kind: 'null', meta: {rem: [['project:0', 'x']]}},
            {name: 'empty', kind: 'null'},
            {name: 'enabled', kind: 'boolean', value: 'false'},
            {
              name: 'items',
              kind: 'array',
              meta: {len: 4},
              children: [
                {name: '[0]', kind: 'number', value: '0'},
                {name: '[1]', kind: 'number', value: '42'},
              ],
            },
          ],
        },
      ]}
    />
  );

  await userEvent.click(screen.getByRole('button', {name: 'Copy request value'}));
  expect(writeText).toHaveBeenLastCalledWith(
    JSON.stringify(
      {
        authorization: 'Bearer ********',
        token: '<redacted>',
        empty: null,
        enabled: false,
        items: [0, 42],
      },
      null,
      2
    )
  );
  expect(screen.queryByText('authorization')).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', {name: 'Expand request', expanded: false})
  );
  await userEvent.click(screen.getByRole('button', {name: 'Copy authorization value'}));
  expect(writeText).toHaveBeenLastCalledWith('Bearer ********');
  await userEvent.click(screen.getByRole('button', {name: 'Copy token value'}));
  expect(writeText).toHaveBeenLastCalledWith('<redacted>');
});
