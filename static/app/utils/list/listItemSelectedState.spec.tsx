import {type ComponentProps, type PropsWithChildren} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {QueryKeyEndpointOptions} from 'sentry/utils/api/apiQueryKey';
import {ListItemSelectedState} from 'sentry/utils/list/listItemSelectedState';
import {
  ListItemCheckboxProvider,
  useListItemCheckboxContext,
} from 'sentry/utils/list/useListItemCheckboxState';

const endpointOptions: QueryKeyEndpointOptions = {query: {status: 'active'}};

type ProviderProps = ComponentProps<typeof ListItemCheckboxProvider>;

function SelectionControls() {
  const {selectAll, toggleSelected, deselectAll} = useListItemCheckboxContext();
  return (
    <div>
      <button onClick={selectAll}>Select All</button>
      <button onClick={deselectAll}>Deselect All</button>
      <button onClick={() => toggleSelected('1')}>Toggle 1</button>
    </div>
  );
}

function createWrapper(props: Omit<ProviderProps, 'children' | 'endpointOptions'>) {
  return function Wrapper({children}: PropsWithChildren) {
    return (
      <ListItemCheckboxProvider {...props} endpointOptions={endpointOptions}>
        <SelectionControls />
        {children}
      </ListItemCheckboxProvider>
    );
  };
}

function renderSelectedState({
  selected,
  ...providerProps
}: {selected: ComponentProps<typeof ListItemSelectedState>['selected']} & Omit<
  ProviderProps,
  'children' | 'endpointOptions'
>) {
  const Wrapper = createWrapper(providerProps);
  return render(
    <Wrapper>
      <ListItemSelectedState selected={selected}>
        <span>visible</span>
      </ListItemSelectedState>
    </Wrapper>
  );
}

describe('ListItemSelectedState', () => {
  describe('selected="none"', () => {
    it('renders when nothing is selected', () => {
      renderSelectedState({selected: 'none', hits: 3, knownIds: ['1', '2', '3']});
      expect(screen.getByText('visible')).toBeInTheDocument();
    });

    it('does not render when all are selected', async () => {
      renderSelectedState({selected: 'none', hits: 3, knownIds: ['1', '2', '3']});
      await userEvent.click(screen.getByRole('button', {name: 'Select All'}));
      expect(screen.queryByText('visible')).not.toBeInTheDocument();
    });

    it('does not render when some are selected', async () => {
      renderSelectedState({selected: 'none', hits: 3, knownIds: ['1', '2', '3']});
      await userEvent.click(screen.getByRole('button', {name: 'Toggle 1'}));
      expect(screen.queryByText('visible')).not.toBeInTheDocument();
    });
  });

  describe('selected="all"', () => {
    it('renders when all are selected', async () => {
      renderSelectedState({selected: 'all', hits: 3, knownIds: ['1', '2', '3']});
      await userEvent.click(screen.getByRole('button', {name: 'Select All'}));
      expect(screen.getByText('visible')).toBeInTheDocument();
    });

    it('does not render when nothing is selected', () => {
      renderSelectedState({selected: 'all', hits: 3, knownIds: ['1', '2', '3']});
      expect(screen.queryByText('visible')).not.toBeInTheDocument();
    });

    it('does not render when some are selected', async () => {
      renderSelectedState({selected: 'all', hits: 3, knownIds: ['1', '2', '3']});
      await userEvent.click(screen.getByRole('button', {name: 'Toggle 1'}));
      expect(screen.queryByText('visible')).not.toBeInTheDocument();
    });
  });

  describe('selected="indeterminate"', () => {
    it('renders when some are selected', async () => {
      renderSelectedState({
        selected: 'indeterminate',
        hits: 3,
        knownIds: ['1', '2', '3'],
      });
      await userEvent.click(screen.getByRole('button', {name: 'Toggle 1'}));
      expect(screen.getByText('visible')).toBeInTheDocument();
    });

    it('does not render when nothing is selected', () => {
      renderSelectedState({
        selected: 'indeterminate',
        hits: 3,
        knownIds: ['1', '2', '3'],
      });
      expect(screen.queryByText('visible')).not.toBeInTheDocument();
    });

    it('does not render when all are selected', async () => {
      renderSelectedState({
        selected: 'indeterminate',
        hits: 3,
        knownIds: ['1', '2', '3'],
      });
      await userEvent.click(screen.getByRole('button', {name: 'Select All'}));
      expect(screen.queryByText('visible')).not.toBeInTheDocument();
    });
  });

  describe('selected="indeterminate-or-all"', () => {
    it('renders when all are selected', async () => {
      renderSelectedState({
        selected: 'indeterminate-or-all',
        hits: 3,
        knownIds: ['1', '2', '3'],
      });
      await userEvent.click(screen.getByRole('button', {name: 'Select All'}));
      expect(screen.getByText('visible')).toBeInTheDocument();
    });

    it('renders when some are selected', async () => {
      renderSelectedState({
        selected: 'indeterminate-or-all',
        hits: 3,
        knownIds: ['1', '2', '3'],
      });
      await userEvent.click(screen.getByRole('button', {name: 'Toggle 1'}));
      expect(screen.getByText('visible')).toBeInTheDocument();
    });

    it('does not render when nothing is selected', () => {
      renderSelectedState({
        selected: 'indeterminate-or-all',
        hits: 3,
        knownIds: ['1', '2', '3'],
      });
      expect(screen.queryByText('visible')).not.toBeInTheDocument();
    });
  });
});
