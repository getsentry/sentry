import {useRef, useState} from 'react';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {Item} from '@react-stately/collections';
import {useListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useGridList} from 'sentry/components/tokenizedInput/grid/useGridList';
import {DeletableToken} from 'sentry/components/tokenizedInput/token/deletableToken';

interface GridItem {
  key: string;
}

interface GridListProps extends AriaGridListOptions<GridItem> {
  children: CollectionChildren<GridItem>;
  onDelete: (key: string) => void;
}

function GridList({onDelete, ...props}: GridListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useListState<GridItem>(props);
  const {gridProps} = useGridList({
    props,
    state,
    ref,
  });

  return (
    <div {...gridProps} ref={ref}>
      {[...state.collection].map(item => {
        return !item.value ? null : (
          <DeletableToken
            key={item.value.key}
            item={item}
            label={item.value.key}
            state={state}
            onDelete={() => onDelete(item.value!.key)}
          >
            <span data-test-id={`item-${item.key}`}>{item.key}</span>
          </DeletableToken>
        );
      })}
    </div>
  );
}

interface GridProps {
  items: GridItem[];
  onDelete: (key: string) => void;
}

function Grid({onDelete, ...props}: GridProps) {
  return (
    <GridList
      aria-label="grid"
      items={props.items}
      selectionMode="multiple"
      onDelete={onDelete}
    >
      {item => <Item key={item.key}>{item.key}</Item>}
    </GridList>
  );
}

function Component() {
  const [items, setItems] = useState(() =>
    [1, 2, 3].map(
      value =>
        ({
          key: String(value),
        }) as GridItem
    )
  );

  function onDelete(key: string) {
    setItems(items.filter(item => item.key !== key));
  }

  return <Grid items={items} onDelete={onDelete} />;
}

describe('DeletableToken', function () {
  it('can delete tokens', async function () {
    render(<Component />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('gridcell', {name: 'Delete 1'}));
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('gridcell', {name: 'Delete 2'}));
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('gridcell', {name: 'Delete 3'}));
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('shifts focus to child when clicked', async function () {
    render(<Component />);

    expect(screen.getByRole('gridcell', {name: 'Delete 1'})).not.toHaveFocus();
    expect(screen.getByRole('gridcell', {name: 'Delete 2'})).not.toHaveFocus();
    expect(screen.getByRole('gridcell', {name: 'Delete 2'})).not.toHaveFocus();

    await userEvent.click(screen.getByRole('row', {name: '1'}));

    expect(screen.getByRole('gridcell', {name: 'Delete 1'})).toHaveFocus();
    expect(screen.getByRole('gridcell', {name: 'Delete 2'})).not.toHaveFocus();
    expect(screen.getByRole('gridcell', {name: 'Delete 3'})).not.toHaveFocus();

    await userEvent.click(screen.getByRole('row', {name: '2'}));

    expect(screen.getByRole('gridcell', {name: 'Delete 1'})).not.toHaveFocus();
    expect(screen.getByRole('gridcell', {name: 'Delete 2'})).toHaveFocus();
    expect(screen.getByRole('gridcell', {name: 'Delete 3'})).not.toHaveFocus();

    await userEvent.click(screen.getByRole('row', {name: '3'}));

    expect(screen.getByRole('gridcell', {name: 'Delete 1'})).not.toHaveFocus();
    expect(screen.getByRole('gridcell', {name: 'Delete 2'})).not.toHaveFocus();
    expect(screen.getByRole('gridcell', {name: 'Delete 3'})).toHaveFocus();
  });
});
