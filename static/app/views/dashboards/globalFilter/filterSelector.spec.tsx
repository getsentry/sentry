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
      name: `${mockGlobalFilter.tag.key} contains All`,
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
      name: `${mockGlobalFilter.tag.key} contains All`,
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

    const button = screen.getByRole('button', {name: /^browser :/});
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
      name: `${mockGlobalFilter.tag.key} contains All`,
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
      name: `${SpanFields.USER_GEO_SUBREGION} contains All`,
    });
    await userEvent.click(button);

    expect(
      await screen.findByRole('gridcell', {name: /North America/})
    ).toBeInTheDocument();
    expect(screen.getByRole('gridcell', {name: /Northern Europe/})).toBeInTheDocument();
  });

  it('keeps the "is" operator when switching from "(no value)" to a real value', async () => {
    render(
      <FilterSelector
        globalFilter={{...mockGlobalFilter, value: '!has:browser'}}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {name: /browser/});
    await userEvent.click(button);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select (no value)'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select firefox'}));
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(mockOnUpdateFilter).toHaveBeenCalledWith({
      ...mockGlobalFilter,
      value: 'browser:firefox',
    });
  });

  it('keeps the "is not" operator when switching from "(no value)" to a real value', async () => {
    render(
      <FilterSelector
        globalFilter={{...mockGlobalFilter, value: 'has:browser'}}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {name: /browser/});
    await userEvent.click(button);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select (no value)'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select firefox'}));
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(mockOnUpdateFilter).toHaveBeenCalledWith({
      ...mockGlobalFilter,
      value: '!browser:firefox',
    });
  });

  it('collapses "contains" to "is" when only "(no value)" is persisted', async () => {
    const {rerender} = render(
      <FilterSelector
        globalFilter={mockGlobalFilter}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {
      name: `${mockGlobalFilter.tag.key} contains All`,
    });
    await userEvent.click(button);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select (no value)'}));
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(mockOnUpdateFilter).toHaveBeenCalledWith({
      ...mockGlobalFilter,
      value: '!has:browser',
    });

    rerender(
      <FilterSelector
        globalFilter={{...mockGlobalFilter, value: '!has:browser'}}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const trigger = screen.getByRole('button', {name: /browser/});
    await waitFor(() => expect(trigger).not.toHaveTextContent('contains'));
    expect(trigger).toHaveTextContent('(no value)');
  });

  it('rewrites the value without corrupting the query when editing a combined value + "(no value)" filter', async () => {
    render(
      <FilterSelector
        globalFilter={{...mockGlobalFilter, value: '(browser:chrome OR !has:browser)'}}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {name: /browser/});
    await userEvent.click(button);

    expect(await screen.findByRole('checkbox', {name: 'Select chrome'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select (no value)'})).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select firefox'}));
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    const emittedValue = mockOnUpdateFilter.mock.calls.at(-1)?.[0]?.value as string;
    expect(emittedValue).toBe('(browser:[chrome,firefox] OR !has:browser)');
  });

  it('intersects (AND) a value with "(no value)" when the operator is negated', async () => {
    render(
      <FilterSelector
        globalFilter={{...mockGlobalFilter, value: 'has:browser'}}
        searchBarData={mockSearchBarData}
        onUpdateFilter={mockOnUpdateFilter}
        onRemoveFilter={mockOnRemoveFilter}
      />
    );

    const button = screen.getByRole('button', {name: /browser/});
    await userEvent.click(button);

    expect(
      await screen.findByRole('checkbox', {name: 'Select (no value)'})
    ).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select firefox'}));
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(mockOnUpdateFilter).toHaveBeenCalledWith({
      ...mockGlobalFilter,
      value: '(!browser:firefox AND has:browser)',
    });
  });

  describe('emits the correct query for each operator + "(no value)" combination', () => {
    async function openSelector() {
      await userEvent.click(screen.getByRole('button', {name: /browser/}));
    }

    async function selectOperator(target: string, current = 'contains') {
      await userEvent.click(screen.getByRole('button', {name: current}));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: target}));
    }

    async function selectNoValue() {
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select (no value)'}));
    }

    async function apply() {
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    }

    function lastEmittedValue() {
      return mockOnUpdateFilter.mock.calls.at(-1)?.[0]?.value as string;
    }

    describe('with no existing value', () => {
      it.each([
        ['is', '!has:browser'],
        ['is not', 'has:browser'],
        ['contains', '!has:browser'],
        ['does not contain', 'has:browser'],
      ])('%s + (no value) -> %s', async (operator, expected) => {
        render(
          <FilterSelector
            globalFilter={mockGlobalFilter}
            searchBarData={mockSearchBarData}
            onUpdateFilter={mockOnUpdateFilter}
            onRemoveFilter={mockOnRemoveFilter}
          />
        );

        await openSelector();
        if (operator !== 'contains') {
          await selectOperator(operator);
        }
        await selectNoValue();
        await apply();

        expect(lastEmittedValue()).toBe(expected);
      });
    });

    describe('with an existing value', () => {
      it.each([
        ['is', '(browser:firefox OR !has:browser)'],
        ['is not', '(!browser:firefox AND has:browser)'],
        ['contains', `(browser:${WildcardOperators.CONTAINS}firefox OR !has:browser)`],
        [
          'does not contain',
          `(!browser:${WildcardOperators.CONTAINS}firefox AND has:browser)`,
        ],
      ])('%s value + (no value) -> %s', async (operator, expected) => {
        render(
          <FilterSelector
            globalFilter={mockGlobalFilter}
            searchBarData={mockSearchBarData}
            onUpdateFilter={mockOnUpdateFilter}
            onRemoveFilter={mockOnRemoveFilter}
          />
        );

        await openSelector();
        if (operator !== 'contains') {
          await selectOperator(operator);
        }
        await userEvent.click(screen.getByRole('checkbox', {name: 'Select firefox'}));
        await selectNoValue();
        await apply();

        expect(lastEmittedValue()).toBe(expected);
      });
    });
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
      name: `${mockGlobalFilter.tag.key} contains All`,
    });
    await userEvent.click(button);

    // Wait for options to load - both values should be visible initially
    expect(await screen.findByText(shortValue)).toBeInTheDocument();
    // Two tag values plus the prepended "(no value)" option
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);

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
