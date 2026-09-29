import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  await userEvent.click(summary);
  expect(summary).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
