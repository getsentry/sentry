import React from 'react';

import {render} from 'sentry-test/reactTestingLibrary';

import {slot} from '@sentry/scraps/slot';

import {makeCollection} from './collection';

interface NodeData {
  name: string;
}

const TestCollection = makeCollection<NodeData>();

function Group({children, name}: {name: string; children?: React.ReactNode}) {
  const key = TestCollection.useRegisterNode({name});
  return (
    <TestCollection.Context.Provider value={key}>
      {children}
    </TestCollection.Context.Provider>
  );
}

function Item({name}: {name: string}) {
  TestCollection.useRegisterNode({name});
  return null;
}

function StoreCapture({
  storeRef,
}: {
  storeRef: React.MutableRefObject<ReturnType<typeof TestCollection.useStore> | null>;
}) {
  storeRef.current = TestCollection.useStore();
  return null;
}

function makeStoreRef() {
  return React.createRef() as React.MutableRefObject<ReturnType<
    typeof TestCollection.useStore
  > | null>;
}

describe('Collection', () => {
  it('builds the tree from JSX structure', () => {
    const storeRef = makeStoreRef();

    render(
      <TestCollection.Provider>
        <Group name="Title">
          <Item name="Item 1" />
          <Group name="Item 2">
            <Item name="Item 2.1" />
            <Item name="Item 2.2" />
          </Group>
        </Group>
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    const tree = storeRef.current!.tree();
    expect(tree).toHaveLength(1);

    const titleGroup = tree[0]!;
    expect(titleGroup.name).toBe('Title');
    expect(titleGroup.parent).toBeNull();
    expect(titleGroup.children).toHaveLength(2);

    const item1 = titleGroup.children[0]!;
    const nestedGroup = titleGroup.children[1]!;
    expect(item1.name).toBe('Item 1');
    expect(item1.children).toHaveLength(0);
    expect(nestedGroup.name).toBe('Item 2');
    expect(nestedGroup.children).toHaveLength(2);
  });

  it('preserves JSX sibling order in the tree', () => {
    const storeRef = makeStoreRef();

    render(
      <TestCollection.Provider>
        <Item name="first" />
        <Item name="second" />
        <Item name="third" />
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    const names = storeRef.current!.tree().map(n => n.name);
    expect(names).toEqual(['first', 'second', 'third']);
  });

  it('preserves JSX order when siblings include groups with deep children', () => {
    const storeRef = makeStoreRef();

    render(
      <TestCollection.Provider>
        <Item name="before" />
        <Group name="middle">
          <Item name="child 1" />
          <Item name="child 2" />
        </Group>
        <Item name="after" />
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    const names = storeRef.current!.tree().map(n => n.name);
    expect(names).toEqual(['before', 'middle', 'after']);
  });

  it('returns a subtree rooted at a given key via tree(rootKey)', () => {
    const storeRef = makeStoreRef();

    render(
      <TestCollection.Provider>
        <Group name="A">
          <Item name="A1" />
          <Item name="A2" />
        </Group>
        <Group name="B">
          <Item name="B1" />
        </Group>
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    const groupA = storeRef.current!.tree()[0]!;
    const subtree = storeRef.current!.tree(groupA.key);
    expect(subtree.map(n => n.name)).toEqual(['A1', 'A2']);
  });

  it('unregisters nodes when they unmount', () => {
    const storeRef = makeStoreRef();

    const {rerender} = render(
      <TestCollection.Provider>
        <Group name="Title">
          <Item name="Item 1" />
        </Group>
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    expect(storeRef.current!.tree()).toHaveLength(1);

    rerender(
      <TestCollection.Provider>
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    expect(storeRef.current!.tree()).toHaveLength(0);
  });

  it('unregisters a removed node while leaving siblings intact', () => {
    const storeRef = makeStoreRef();

    // Explicit React keys so reconciliation preserves Group B's component instance
    // (and its registered collection key) when Group A is removed.
    const {rerender} = render(
      <TestCollection.Provider>
        <Group key="A" name="A">
          <Item name="A1" />
        </Group>
        <Group key="B" name="B">
          <Item name="B1" />
        </Group>
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    const groupBKey = storeRef.current!.tree()[1]!.key;

    rerender(
      <TestCollection.Provider>
        <Group key="B" name="B">
          <Item name="B1" />
        </Group>
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    expect(storeRef.current!.tree()).toHaveLength(1);
    expect(storeRef.current!.tree(groupBKey).map(n => n.name)).toEqual(['B1']);
  });

  it('updates the tree when a conditional node mounts and unmounts', () => {
    const storeRef = makeStoreRef();

    const {rerender} = render(
      <TestCollection.Provider>
        <Item name="always" />
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    rerender(
      <TestCollection.Provider>
        <Item name="always" />
        <Item name="conditional" />
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    expect(storeRef.current!.tree().map(n => n.name)).toEqual(['always', 'conditional']);

    rerender(
      <TestCollection.Provider>
        <Item name="always" />
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    expect(storeRef.current!.tree().map(n => n.name)).toEqual(['always']);
  });

  it('reflects updated data without re-registering', () => {
    const storeRef = makeStoreRef();

    const {rerender} = render(
      <TestCollection.Provider>
        <Item name="original" />
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    rerender(
      <TestCollection.Provider>
        <Item name="updated" />
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    expect(storeRef.current!.tree()[0]!.name).toBe('updated');
  });

  it('propagates parent keys correctly at 3+ levels of nesting', () => {
    const storeRef = makeStoreRef();

    render(
      <TestCollection.Provider>
        <Group name="L1">
          <Group name="L2">
            <Group name="L3">
              <Item name="deep" />
            </Group>
          </Group>
        </Group>
        <StoreCapture storeRef={storeRef} />
      </TestCollection.Provider>
    );

    const l1 = storeRef.current!.tree()[0]!;
    expect(l1.parent).toBeNull();

    const l2 = l1.children[0]!;
    expect(l2.parent).toBe(l1.key);

    const l3 = l2.children[0]!;
    expect(l3.parent).toBe(l2.key);

    const deep = l3.children[0]!;
    expect(deep.parent).toBe(l3.key);
    expect(deep.name).toBe('deep');
  });

  it('isolates two independent collection instances', () => {
    const A = makeCollection<NodeData>();
    const B = makeCollection<NodeData>();

    const storeRefA = {current: null} as React.MutableRefObject<ReturnType<
      typeof A.useStore
    > | null>;
    const storeRefB = {current: null} as React.MutableRefObject<ReturnType<
      typeof B.useStore
    > | null>;

    function ItemA({name}: {name: string}) {
      A.useRegisterNode({name});
      return null;
    }
    function ItemB({name}: {name: string}) {
      B.useRegisterNode({name});
      return null;
    }
    function CaptureA() {
      storeRefA.current = A.useStore();
      return null;
    }
    function CaptureB() {
      storeRefB.current = B.useStore();
      return null;
    }

    render(
      <React.Fragment>
        <A.Provider>
          <ItemA name="a-item" />
          <CaptureA />
        </A.Provider>
        <B.Provider>
          <ItemB name="b-item" />
          <CaptureB />
        </B.Provider>
      </React.Fragment>
    );

    expect(storeRefA.current!.tree().map(n => n.name)).toEqual(['a-item']);
    expect(storeRefB.current!.tree().map(n => n.name)).toEqual(['b-item']);
  });

  it('items portaled via Slot register at their declaration site, not the outlet location', () => {
    // This test verifies that React portals preserve component tree context.
    // An Item declared inside a Slot.Consumer should register in the collection
    // based on the GroupContext at the Consumer's position — not the Outlet's position.
    const ActionSlot = slot(['actions'] as const);
    const storeRef = makeStoreRef();

    render(
      <ActionSlot.Provider>
        <TestCollection.Provider>
          {/* Outlet is nested inside a Group — this is where items appear in the DOM */}
          <Group name="outlet-group">
            <ActionSlot.Outlet name="actions">
              {({ref}) => <div ref={ref} />}
            </ActionSlot.Outlet>
          </Group>

          {/* Consumer is at root level (outside any Group) — this is where context is read */}
          <ActionSlot name="actions">
            <Item name="slotted-item" />
          </ActionSlot>

          <StoreCapture storeRef={storeRef} />
        </TestCollection.Provider>
      </ActionSlot.Provider>
    );

    const tree = storeRef.current!.tree();
    const outletGroup = tree.find(n => n.name === 'outlet-group')!;
    const slottedItem = tree.find(n => n.name === 'slotted-item')!;

    // Item appears in the DOM inside outlet-group, but registers at root level
    // because the Slot.Consumer was mounted outside any Group.
    expect(slottedItem).toBeDefined();
    expect(slottedItem.parent).toBeNull();
    expect(outletGroup.children.map(n => n.name)).not.toContain('slotted-item');
  });

  it('items portaled via Slot register under the Group wrapping the Consumer', () => {
    const ActionSlot = slot(['actions'] as const);
    const storeRef = makeStoreRef();

    render(
      <ActionSlot.Provider>
        <TestCollection.Provider>
          {/* Consumer is inside source-group — items pick up that GroupContext */}
          <Group name="source-group">
            <ActionSlot name="actions">
              <Item name="slotted-item" />
            </ActionSlot>
          </Group>

          {/* Outlet is in a different Group — items portal here in the DOM */}
          <Group name="target-group">
            <ActionSlot.Outlet name="actions">
              {({ref}) => <div ref={ref} />}
            </ActionSlot.Outlet>
          </Group>

          <StoreCapture storeRef={storeRef} />
        </TestCollection.Provider>
      </ActionSlot.Provider>
    );

    const tree = storeRef.current!.tree();
    const sourceGroup = tree.find(n => n.name === 'source-group')!;
    const targetGroup = tree.find(n => n.name === 'target-group')!;

    // Item registers under source-group (where Consumer was declared),
    // not target-group (where it portals in the DOM).
    expect(sourceGroup.children.map(n => n.name)).toContain('slotted-item');
    expect(targetGroup.children.map(n => n.name)).not.toContain('slotted-item');
  });

  it('throws when useStore is called outside the Provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      TestCollection.useStore();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useStore must be called inside the matching Collection Provider'
    );

    consoleSpy.mockRestore();
  });
});
