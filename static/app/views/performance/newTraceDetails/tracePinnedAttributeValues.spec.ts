import {OrganizationFixture} from 'sentry-fixture/organization';

import {CollapsedNode} from './traceModels/traceTreeNode/collapsedNode';
import {EapSpanNode} from './traceModels/traceTreeNode/eapSpanNode';
import {ParentAutogroupNode} from './traceModels/traceTreeNode/parentAutogroupNode';
import {SiblingAutogroupNode} from './traceModels/traceTreeNode/siblingAutogroupNode';
import {
  makeEAPSpan,
  makeParentAutogroup,
  makeSiblingAutogroup,
} from './traceModels/traceTreeTestUtils';
import {
  getPinnedAttributeValue,
  MULTIPLE_PINNED_VALUES,
  type PinnedAttributeValue,
} from './tracePinnedAttributeValues';

const extra = {organization: OrganizationFixture()};
const span = (id: string) => new EapSpanNode(null, makeEAPSpan({event_id: id}), extra);

it.each([0, false, '', 'test', null])(
  'preserves a span value of %p even when its children differ',
  value => {
    const parent = span('parent');
    parent.children = [span('child')];
    const values = new Map<string, PinnedAttributeValue>([
      ['parent', value],
      ['child', 'other'],
    ]);
    expect(getPinnedAttributeValue(parent, values)).toBe(value);
  }
);

it.each(['siblings', 'parents'])(
  'leaves %s auto-groups empty regardless of member values',
  kind => {
    const first = span('first');
    const last = span('last');
    const sibling = new SiblingAutogroupNode(
      null,
      makeSiblingAutogroup({type: 'sibling_autogroup'}),
      extra
    );
    sibling.children = [first, last];
    first.children = [last];
    const parent = new ParentAutogroupNode(
      null,
      makeParentAutogroup({type: 'children_autogroup'}),
      extra,
      first,
      last
    );
    const node = kind === 'siblings' ? sibling : parent;
    const values = new Map<string, PinnedAttributeValue>();
    expect(getPinnedAttributeValue(node, values)).toBeNull();
    values.set('first', 'same');
    expect(getPinnedAttributeValue(node, values)).toBeNull();
    values.set('last', 'same');
    expect(getPinnedAttributeValue(node, values)).toBeNull();
    values.set('last', 'other');
    expect(getPinnedAttributeValue(node, values)).toBeNull();
  }
);

it('summarizes collapsed span groups, including missing values', () => {
  const first = span('first');
  const last = span('last');
  first.children = [last];
  const node = new CollapsedNode(span('root'), {type: 'collapsed'}, extra);
  node.children = [first];
  const values = new Map<string, PinnedAttributeValue>();
  expect(getPinnedAttributeValue(node, values)).toBeNull();
  values.set('first', 'same');
  expect(getPinnedAttributeValue(node, values)).toBe(MULTIPLE_PINNED_VALUES);
  values.set('last', 'same');
  expect(getPinnedAttributeValue(node, values)).toBe('same');
  values.set('last', 'other');
  expect(getPinnedAttributeValue(node, values)).toBe(MULTIPLE_PINNED_VALUES);
});
