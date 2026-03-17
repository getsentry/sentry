import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FieldKind} from 'sentry/utils/fields';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import FilterSelector from 'sentry/views/dashboards/globalFilter/filterSelector';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {SpanFields} from 'sentry/views/insights/types';

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

  it('translates subregion codes to human-readable names for spans dataset', async () => {
    const subregionFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {
        key: SpanFields.USER_GEO_SUBREGION,
        name: 'User Geo Subregion',
        kind: FieldKind.FIELD,
      },
      value: '',
    };

    const subregionSearchBarData: SearchBarData = {
      getFilterKeySections: () => [],
      getFilterKeys: () => ({}),
      getTagValues: () => Promise.resolve(['21', '154']),
    };

    render(
      <FilterSelector
        globalFilter={subregionFilter}
        searchBarData={subregionSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {
      name: SpanFields.USER_GEO_SUBREGION + ' :',
    });
    await userEvent.click(button);

    expect(screen.getByRole('row', {name: 'North America'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Northern Europe'})).toBeInTheDocument();
    expect(screen.queryByRole('row', {name: '21'})).not.toBeInTheDocument();
    expect(screen.queryByRole('row', {name: '154'})).not.toBeInTheDocument();
  });
});
