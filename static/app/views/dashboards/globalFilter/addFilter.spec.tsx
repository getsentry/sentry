import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {type SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import AddFilter, {DATASET_CHOICES} from 'sentry/views/dashboards/globalFilter/addFilter';
import {WidgetType} from 'sentry/views/dashboards/types';

describe('AddFilter', () => {
  // Mock filter keys returned by the search bar data provider
  const mockFilterKeys: TagCollection = {
    'browser.name': {
      key: 'browser.name',
      name: 'Browser Name',
      kind: FieldKind.FIELD,
    },
    environment: {
      key: 'environment',
      name: 'Environment',
      kind: FieldKind.FIELD,
    },
    'unsupported.function': {
      key: 'unsupported.function',
      name: 'Unsupported Function',
      kind: FieldKind.FUNCTION,
    },
  };

  const getSearchBarData = (_: WidgetType): SearchBarData => ({
    getFilterKeys: () => mockFilterKeys,
    getFilterKeySections: () => [],
    getTagValues: () => Promise.resolve([]),
  });

  it('renders all dataset options', async () => {
    render(
      <AddFilter
        globalFilters={[]}
        getSearchBarData={getSearchBarData}
        onAddFilter={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));
    for (const dataset of DATASET_CHOICES.values()) {
      expect(screen.getByText(dataset)).toBeInTheDocument();
    }
  });

  it('retrieves filter keys for each dataset', async () => {
    render(
      <AddFilter
        globalFilters={[]}
        getSearchBarData={getSearchBarData}
        onAddFilter={() => {}}
      />
    );

    // Open the add global filter drop down
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));

    // Verify filter keys are shown for each dataset
    await userEvent.click(screen.getByText('Errors'));

    // Should see filter key options for the dataset
    expect(screen.getByText('Select Errors Tag')).toBeInTheDocument();
    expect(screen.getByText(mockFilterKeys['browser.name']!.key)).toBeInTheDocument();
    expect(screen.getByText(mockFilterKeys.environment!.key)).toBeInTheDocument();

    // Return to dataset selection
    await userEvent.click(screen.getByText('Back'));
  });

  it('does not render unsupported filter keys', async () => {
    render(
      <AddFilter
        globalFilters={[]}
        getSearchBarData={getSearchBarData}
        onAddFilter={() => {}}
      />
    );

    // Open the dropdown and select an arbitrary dataset
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));
    await userEvent.click(screen.getByText('Errors'));

    // Unsupported filter keys should not be included in the options
    expect(
      screen.queryByText(mockFilterKeys['unsupported.function']!.key)
    ).not.toBeInTheDocument();
  });

  it('calls onAddFilter with expected global filter object', async () => {
    const onAddFilter = jest.fn();
    render(
      <AddFilter
        globalFilters={[]}
        getSearchBarData={getSearchBarData}
        onAddFilter={onAddFilter}
      />
    );

    // Open add global filter drop down
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));

    // Select arbitrary dataset and filter key
    await userEvent.click(screen.getByText('Errors'));
    await userEvent.click(
      screen.getByRole('option', {name: mockFilterKeys['browser.name']!.key})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add Filter'}));

    // Verify onAddFilter was called with the added global filter object
    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expect(onAddFilter).toHaveBeenCalledWith({
      dataset: WidgetType.ERRORS,
      tag: mockFilterKeys['browser.name'],
      value: '',
    });
  });
});
