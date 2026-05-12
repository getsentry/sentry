import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {FieldKind} from 'sentry/utils/fields';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import {FilterSelector} from 'sentry/views/dashboards/globalFilter/filterSelector';
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

    const button = screen.getByRole('button', {
      name: `${mockGlobalFilter.tag.key} contains`,
    });
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

    const button = screen.getByRole('button', {
      name: `${mockGlobalFilter.tag.key} contains`,
    });
    await userEvent.click(button);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select firefox'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select chrome'}));
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(mockOnUpdateFilter).toHaveBeenCalledWith({
      ...mockGlobalFilter,
      value: `browser:${WildcardOperators.CONTAINS}[firefox,chrome]`,
    });

    await userEvent.click(button);
    await userEvent.click(screen.getByRole('row', {name: 'chrome'}));

    expect(mockOnUpdateFilter).toHaveBeenCalledWith({
      ...mockGlobalFilter,
      value: `browser:${WildcardOperators.CONTAINS}chrome`,
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

    const button = screen.getByRole('button', {
      name: `${mockGlobalFilter.tag.key} contains`,
    });
    await userEvent.click(button);
    await userEvent.click(screen.getByRole('button', {name: 'Remove Filter'}));

    expect(mockOnRemoveFilter).toHaveBeenCalledWith(mockGlobalFilter);
  });

  it('does not reset selected values when dismissing the select without applying', async () => {
    const fiveValueSearchBarData: SearchBarData = {
      getFilterKeySections: () => [],
      getFilterKeys: () => ({}),
      getTagValues: () =>
        Promise.resolve(['chrome', 'firefox', 'safari', 'edge', 'opera']),
    };

    render(
      <FilterSelector
        globalFilter={{...mockGlobalFilter, value: 'browser:[firefox,chrome]'}}
        searchBarData={fiveValueSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    // Open the select
    const button = screen.getByRole('button', {name: /browser/});
    await userEvent.click(button);

    // Wait for options to load
    expect(await screen.findByText('chrome')).toBeInTheDocument();

    // Dismiss by clicking outside (without applying)
    await userEvent.click(document.body);

    // Wait for the dropdown to close (overlay removed from DOM)
    await waitFor(() => {
      expect(screen.queryByText('safari')).not.toBeInTheDocument();
    });

    // Flush requestAnimationFrame callbacks (control.tsx uses nextFrameCallback for onClose)
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });

    // The underlying filter value should not have been modified
    expect(mockOnUpdateFilter).not.toHaveBeenCalled();

    // The trigger should still show the selected values, not "All"
    expect(screen.queryByText('All')).not.toBeInTheDocument();
    expect(screen.getByText('firefox')).toBeInTheDocument();
  });

  it('shows selected value in trigger when tag values fail to load', async () => {
    const emptySearchBarData: SearchBarData = {
      getFilterKeySections: () => [],
      getFilterKeys: () => ({}),
      getTagValues: () => Promise.resolve([]),
    };

    render(
      <FilterSelector
        globalFilter={{...mockGlobalFilter, value: 'browser:firefox'}}
        searchBarData={emptySearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    // Even with no fetched tag values, should show selected value, not "All"
    expect(await screen.findByText('firefox')).toBeInTheDocument();
    expect(screen.queryByText('All')).not.toBeInTheDocument();
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
      name: `${SpanFields.USER_GEO_SUBREGION} contains`,
    });
    await userEvent.click(button);

    expect(
      await screen.findByRole('gridcell', {name: /North America/})
    ).toBeInTheDocument();
    expect(screen.getByRole('gridcell', {name: /Northern Europe/})).toBeInTheDocument();
  });

  it('allows searching for values over 70 characters', async () => {
    // Create a long transaction name that exceeds 70 characters
    const longValue =
      'GET /api/organizations/{organization_slug}/projects/{project_slug}/events/{event_id}/committers/';
    const shortValue = 'chrome';
    const longValueSearchBarData: SearchBarData = {
      getFilterKeySections: () => [],
      getFilterKeys: () => ({}),
      getTagValues: () => Promise.resolve([longValue, shortValue]),
    };

    render(
      <FilterSelector
        globalFilter={mockGlobalFilter}
        searchBarData={longValueSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {
      name: `${mockGlobalFilter.tag.key} contains`,
    });
    await userEvent.click(button);

    // Wait for options to load - both values should be visible initially
    expect(await screen.findByText(shortValue)).toBeInTheDocument();
    // Verify we have 2 checkboxes (one for each option)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);

    // Search for the entire long value to test that search works on the full textValue
    // even though the displayed label is truncated at 70 characters
    const searchInput = screen.getByPlaceholderText('Search or enter a custom value...');
    await userEvent.click(searchInput);
    await userEvent.paste(longValue);

    // After searching, only the long value should match
    // Verify we now have only 1 checkbox (the matching long value)
    await waitFor(() => {
      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    });
    // The short value should be filtered out
    expect(screen.queryByText(shortValue)).not.toBeInTheDocument();
  });
});
