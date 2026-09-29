import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {getJsonFrameVariables} from 'sentry/components/stackTrace/frame/getJsonFrameVariables';
import {NativeFrameVariables} from 'sentry/components/stackTrace/frame/nativeFrameVariables';

it('preserves JSON values and nested annotations without adding type labels', async () => {
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

  expect(variables.map(({name}) => name)).toEqual([
    'count',
    'empty',
    'enabled',
    'items',
    'player',
  ]);
  expect(variables).toEqual([
    expect.objectContaining({name: 'count', kind: 'number', value: '42'}),
    expect.objectContaining({name: 'empty', kind: 'null'}),
    expect.objectContaining({
      name: 'enabled',
      kind: 'boolean',
      value: 'true',
    }),
    expect.objectContaining({
      name: 'items',
      kind: 'array',
      meta: arrayMeta,
      children: [
        expect.objectContaining({name: '[0]', kind: 'string', meta: meta.items['0']['']}),
      ],
    }),
    expect.objectContaining({
      name: 'player',
      kind: 'object',
      children: [
        expect.objectContaining({name: 'active', kind: 'boolean', value: 'false'}),
        expect.objectContaining({name: 'name', kind: 'string', value: 'Alice'}),
        expect.objectContaining({name: 'token', kind: 'null', meta: removedMeta}),
      ],
    }),
  ]);

  render(
    <NativeFrameVariables
      variables={variables}
      platform="node"
      defaultExpanded={['player']}
    />
  );

  expect(screen.getByText('true')).toBeInTheDocument();
  expect(screen.getByText('false')).toBeInTheDocument();
  expect(screen.getByText('null')).toBeInTheDocument();
  expect(screen.queryByText('boolean')).not.toBeInTheDocument();
  expect(screen.queryByText('number')).not.toBeInTheDocument();
  expect(screen.queryByText('object')).not.toBeInTheDocument();
  expect(screen.queryByText('nullptr')).not.toBeInTheDocument();
  await userEvent.hover(screen.getByText('<redacted>'));
  expect(
    await screen.findByText('Removed because of SDK configuration')
  ).toBeInTheDocument();
  await userEvent.unhover(screen.getByText('<redacted>'));
  await userEvent.click(screen.getByText('[ 4 items ]'));
  expect(screen.getByText('[Filtered]')).toBeInTheDocument();
  expect(screen.getByText('(3 items truncated)')).toBeInTheDocument();
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
