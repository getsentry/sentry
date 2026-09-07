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
              children: [{name: 'x', type: 'float', kind: 'number', value: '1.5'}],
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
  await userEvent.click(screen.getByText('{ 1 item }'));
  expect(screen.getByText('1.5')).toBeInTheDocument();
  const toggle = screen.getByRole('button', {name: 'Collapse position'});
  toggle.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByText('1.5')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', {name: 'Expand position'})[0]).toHaveAttribute(
    'aria-expanded',
    'false'
  );
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
