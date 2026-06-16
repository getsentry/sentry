import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ReplayTableHeader} from 'sentry/components/replays/table/replayTableHeader';
import {type ListItemCheckboxState} from 'sentry/utils/list/useListItemCheckboxState';

jest.mock('sentry/components/replays/table/replayBulkViewedActions', () => ({
  ReplayBulkViewedActions: () => <div data-test-id="replay-bulk-viewed-actions" />,
}));

jest.mock('sentry/components/replays/table/deleteReplays', () => ({
  DeleteReplays: () => <div data-test-id="delete-replays" />,
}));

const mockUseListItemCheckboxContext = jest.fn();

jest.mock('sentry/utils/list/useListItemCheckboxState', () => ({
  get useListItemCheckboxContext() {
    return mockUseListItemCheckboxContext;
  },
}));

function baseListCheckboxState(overrides: Partial<ListItemCheckboxState>) {
  return {
    countSelected: 0,
    deselectAll: jest.fn(),
    hits: 5,
    isAllSelected: false,
    isAnySelected: false,
    isSelected: () => false,
    knownIds: ['a', 'b'],
    endpointOptionsRef: {current: undefined},
    selectAll: jest.fn(),
    selectedIds: [],
    toggleSelected: jest.fn(),
    ...overrides,
  };
}

function renderWithOrganization() {
  render(
    <ReplayTableHeader
      columns={[
        {
          Header: 'Test',
          Component: () => null,
          interactive: false,
          sortKey: undefined,
        },
      ]}
      replays={[]}
    />,
    {organization: OrganizationFixture()}
  );
}

describe('ReplayTableHeader', () => {
  it('renders no bulk action row when nothing is selected (isAnySelected is false)', () => {
    mockUseListItemCheckboxContext.mockReturnValue(
      baseListCheckboxState({isAnySelected: false, selectedIds: []})
    );

    renderWithOrganization();

    expect(screen.queryByTestId('replay-bulk-viewed-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-replays')).not.toBeInTheDocument();
  });

  it('renders bulk row with delete but not mark-viewed when selectedIds is "all"', () => {
    mockUseListItemCheckboxContext.mockReturnValue(
      baseListCheckboxState({
        isAnySelected: true,
        isAllSelected: true,
        countSelected: 5,
        selectedIds: 'all',
      })
    );

    renderWithOrganization();

    expect(screen.queryByTestId('replay-bulk-viewed-actions')).not.toBeInTheDocument();
    expect(screen.getByTestId('delete-replays')).toBeInTheDocument();
  });

  it('renders both mark-viewed and delete when specific ids are selected', () => {
    mockUseListItemCheckboxContext.mockReturnValue(
      baseListCheckboxState({
        isAnySelected: true,
        isAllSelected: 'indeterminate',
        countSelected: 1,
        selectedIds: ['replay-1'],
      })
    );

    renderWithOrganization();

    expect(screen.getByTestId('replay-bulk-viewed-actions')).toBeInTheDocument();
    expect(screen.getByTestId('delete-replays')).toBeInTheDocument();
  });
});
