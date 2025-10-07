import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import AddFilter, {DATASET_CHOICES} from 'sentry/views/dashboards/globalFilter/addFilter';
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

  const mockUseSearchBarDataProvider = jest.fn(() => ({
    getFilterKeys: () => mockFilterKeys,
  }));

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    // Mock getDatasetConfig that returns a config with a mock search bar data provider
    jest.mocked(getDatasetConfig).mockReturnValue({
      useSearchBarDataProvider: mockUseSearchBarDataProvider,
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders all dataset options', async () => {
    render(<AddFilter onAddFilter={() => {}} />);
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));
    for (const dataset of DATASET_CHOICES.values()) {
      expect(screen.getByText(dataset)).toBeInTheDocument();
    }
  });

  it('retrieves filter keys for each dataset', async () => {
    render(<AddFilter onAddFilter={() => {}} />);

    // Open the add global filter drop down
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));

    // Verify search bar data provider was called for each dataset type
    for (const [widgetType] of DATASET_CHOICES.entries()) {
      expect(getDatasetConfig).toHaveBeenCalledWith(widgetType);
    }
    expect(mockUseSearchBarDataProvider).toHaveBeenCalledTimes(DATASET_CHOICES.size);

    // Verify filter keys are shown for each dataset
    for (const datasetLabel of DATASET_CHOICES.values()) {
      await userEvent.click(screen.getByText(datasetLabel));

      // Should see filter key options for the dataset
      expect(screen.getByText('Select Filter Tag')).toBeInTheDocument();
      expect(screen.getByText(mockFilterKeys.browser!.key)).toBeInTheDocument();
      expect(screen.getByText(mockFilterKeys.environment!.key)).toBeInTheDocument();

      // Return to dataset selection
      await userEvent.click(screen.getByText('Back'));
    }
  });

  it('does not render unsupported filter keys', async () => {
    render(<AddFilter onAddFilter={() => {}} />);

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
    render(<AddFilter onAddFilter={onAddFilter} />);

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
