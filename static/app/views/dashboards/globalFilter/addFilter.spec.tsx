import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {type SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import AddFilter, {DATASET_CHOICES} from 'sentry/views/dashboards/globalFilter/addFilter';
import {type DatasetSearchBarData} from 'sentry/views/dashboards/hooks/useSearchBarData';
import {WidgetType} from 'sentry/views/dashboards/types';

// Mock getDatasetConfig
jest.mock('sentry/views/dashboards/datasetConfig/base');

describe('AddFilter', () => {
  // Mock filter keys returned by the search bar data provider
  const mockFilterKeys: TagCollection = {
    browser: {
      key: 'browser',
      name: 'Browser',
      kind: FieldKind.FIELD,
    },
    environment: {
      key: 'environment',
      name: 'Environment',
      kind: FieldKind.FIELD,
    },
    unsupportedFunction: {
      key: 'unsupported.function',
      name: 'Unsupported Function',
      kind: FieldKind.FUNCTION,
    },
    unsupportedMeasurement: {
      key: 'unsupported.measurement',
      name: 'Unsupported Measurement',
      kind: FieldKind.MEASUREMENT,
    },
  };

  const createMockSearchBarData = (): SearchBarData => ({
    getFilterKeys: jest.fn(() => mockFilterKeys),
    getFilterKeySections: jest.fn(() => []),
    getTagValues: jest.fn(() => Promise.resolve([])),
  });

  const mockDatasetSearchBarData: DatasetSearchBarData = {
    [WidgetType.ERRORS]: createMockSearchBarData(),
    [WidgetType.LOGS]: createMockSearchBarData(),
    [WidgetType.SPANS]: createMockSearchBarData(),
    [WidgetType.ISSUE]: createMockSearchBarData(),
    [WidgetType.RELEASE]: createMockSearchBarData(),
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders all dataset options', async () => {
    render(
      <AddFilter datasetSearchBarData={mockDatasetSearchBarData} onAddFilter={() => {}} />
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));
    for (const dataset of DATASET_CHOICES.values()) {
      expect(screen.getByText(dataset)).toBeInTheDocument();
    }
  });

  it('retrieves filter keys for each dataset', async () => {
    render(
      <AddFilter datasetSearchBarData={mockDatasetSearchBarData} onAddFilter={() => {}} />
    );

    // Open the add global filter drop down
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));

    // Verify filter keys are shown for each dataset
    for (const [widgetType, datasetLabel] of DATASET_CHOICES.entries()) {
      await userEvent.click(screen.getByText(datasetLabel));

      // Verify corresponding dataset filter key getter was called once
      expect(mockDatasetSearchBarData[widgetType].getFilterKeys).toHaveBeenCalledTimes(1);

      // Should see filter key options for the dataset
      expect(screen.getByText('Select Filter Tag')).toBeInTheDocument();
      expect(screen.getByText(mockFilterKeys.browser!.key)).toBeInTheDocument();
      expect(screen.getByText(mockFilterKeys.environment!.key)).toBeInTheDocument();

      // Return to dataset selection
      await userEvent.click(screen.getByText('Back'));
    }
  });

  it('does not render unsupported filter keys', async () => {
    render(
      <AddFilter datasetSearchBarData={mockDatasetSearchBarData} onAddFilter={() => {}} />
    );

    // Open the dropdown and select an arbitrary dataset
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));
    await userEvent.click(screen.getByText('Errors'));

    // Unsupported filter keys should not be included in the options
    expect(
      screen.queryByText(mockFilterKeys.unsupportedFunction!.key)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(mockFilterKeys.unsupportedMeasurement!.key)
    ).not.toBeInTheDocument();
  });

  it('calls onAddFilter with expected global filter object', async () => {
    const onAddFilter = jest.fn();
    render(
      <AddFilter
        datasetSearchBarData={mockDatasetSearchBarData}
        onAddFilter={onAddFilter}
      />
    );

    // Open add global filter drop down
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));

    // Select arbitrary dataset and filter key
    await userEvent.click(screen.getByText('Errors'));
    await userEvent.click(screen.getByText(mockFilterKeys.browser!.key));
    await userEvent.click(screen.getByText('Add Filter'));

    // Verify onAddFilter was called with the added global filter object
    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expect(onAddFilter).toHaveBeenCalledWith({
      dataset: WidgetType.ERRORS,
      tag: mockFilterKeys.browser,
      value: '',
    });
  });
});
