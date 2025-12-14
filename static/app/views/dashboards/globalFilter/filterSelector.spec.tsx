import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FieldKind} from 'sentry/utils/fields';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import FilterSelector from 'sentry/views/dashboards/globalFilter/filterSelector';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';

describe('FilterSelector', () => {
  const mockOnUpdateFilter = jest.fn();
  const mockOnRemoveFilter = jest.fn();

  const mockGlobalFilter: GlobalFilter = {
    dataset: WidgetType.ERRORS,
    tag: {
      key: 'browser',
      name: 'Browser',
      kind: FieldKind.FIELD,
    },
    value: '',
  };

  const mockSearchBarData: SearchBarData = {
    getFilterKeySections: () => [],
    getFilterKeys: () => ({}),
    getTagValues: () => Promise.resolve(['chrome', 'firefox', 'safari']),
  };

  it('renders all filter values', async () => {
    render(
      <FilterSelector
        globalFilter={mockGlobalFilter}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {name: mockGlobalFilter.tag.key + ' :'});
    await userEvent.click(button);

    expect(screen.getByText('chrome')).toBeInTheDocument();
    expect(screen.getByText('firefox')).toBeInTheDocument();
    expect(screen.getByText('safari')).toBeInTheDocument();
  });

  it('calls onUpdateFilter when options are selected', async () => {
    render(
      <FilterSelector
        globalFilter={mockGlobalFilter}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {name: mockGlobalFilter.tag.key + ' :'});
    await userEvent.click(button);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select firefox'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select chrome'}));
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(mockOnUpdateFilter).toHaveBeenCalledWith({
      ...mockGlobalFilter,
      value: 'browser:[firefox,chrome]',
    });

    await userEvent.click(button);
    await userEvent.click(screen.getByRole('row', {name: 'chrome'}));

    expect(mockOnUpdateFilter).toHaveBeenCalledWith({
      ...mockGlobalFilter,
      value: 'browser:chrome',
    });
  });

  it('parses the initial value of the global filter', async () => {
    render(
      <FilterSelector
        globalFilter={{...mockGlobalFilter, value: 'browser:[firefox,chrome]'}}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {name: mockGlobalFilter.tag.key + ' :'});
    await userEvent.click(button);

    expect(screen.getByRole('checkbox', {name: 'Select firefox'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select chrome'})).toBeChecked();
  });

  it('calls onRemoveFilter when remove button is clicked', async () => {
    render(
      <FilterSelector
        globalFilter={mockGlobalFilter}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {name: mockGlobalFilter.tag.key + ' :'});
    await userEvent.click(button);
    await userEvent.click(screen.getByRole('button', {name: 'Remove Filter'}));

    expect(mockOnRemoveFilter).toHaveBeenCalledWith(mockGlobalFilter);
  });
});
