import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import {CollapsedNode} from './traceModels/traceTreeNode/collapsedNode';
import {EapSpanNode} from './traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from './traceModels/traceTreeTestUtils';
import {
  TracePinnedAttributeCell,
  TracePinnedAttributeContext,
} from './tracePinnedAttribute';
import type {PinnedAttributeValues} from './tracePinnedAttributeValues';

const extra = {organization: OrganizationFixture()};
const span = (id: string) => new EapSpanNode(null, makeEAPSpan({event_id: id}), extra);

function cell(
  node: BaseNode,
  values: PinnedAttributeValues,
  {attribute = 'custom.region', isPending = false, isError = false} = {}
) {
  return (
    <TracePinnedAttributeContext
      value={{
        enabled: true,
        attribute,
        values,
        isPending,
        isError,
        setAttribute: jest.fn(),
        retry: jest.fn(),
      }}
    >
      <TracePinnedAttributeCell node={node} />
    </TracePinnedAttributeContext>
  );
}

it.each([
  ['span.duration', 1500, '1.50s'],
  ['span.total_time', 1500, '1.50s'],
  ['duration', 1500, '1.50s'],
  ['gen_ai.cost.total_tokens', 2, '$2'],
] as const)('formats numeric %s values', (attribute, value, label) => {
  render(cell(span('span'), new Map([['span', value]]), {attribute}));
  expect(screen.getByText(label)).toBeInTheDocument();
});

it('only shows a collapsed summary once all its members are loaded', () => {
  const first = span('first');
  first.children = [span('last')];
  const group = new CollapsedNode(span('root'), {type: 'collapsed'}, extra);
  group.children = [first];
  const partialValues = new Map([['first', 'same']]);
  const {rerender} = render(cell(group, partialValues, {isPending: true}));
  expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  expect(screen.queryByText('Multiple values')).not.toBeInTheDocument();

  rerender(cell(group, partialValues, {isError: true}));
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', {name: 'Copy attribute value'})
  ).not.toBeInTheDocument();

  const completeValues = new Map([
    ['first', 'same'],
    ['last', 'same'],
  ]);
  rerender(cell(group, completeValues, {isPending: true}));
  expect(screen.getByText('same')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Copy attribute value'})).toBeEnabled();

  rerender(cell(group, completeValues, {isError: true}));
  expect(screen.getByText('same')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Copy attribute value'})).toBeEnabled();

  // Once pagination succeeds, absent spans are treated as missing attributes.
  rerender(cell(group, partialValues));
  expect(screen.getByText('Multiple values')).toBeInTheDocument();
});
