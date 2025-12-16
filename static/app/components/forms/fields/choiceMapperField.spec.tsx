import type {ComponentProps} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ChoiceMapperField from 'sentry/components/forms/fields/choiceMapperField';

describe('ChoiceMapperField', () => {
  const mockOnChange = jest.fn();
  const mockOnBlur = jest.fn();

  const defaultProps: ComponentProps<typeof ChoiceMapperField> = {
    name: 'test-choice-mapper',
    addButtonText: 'Add Item',
    formatMessageValue: false,
    allowEmpty: false,
    perItemMapping: false,
    addDropdown: {
      items: [
        {value: 'item1', label: 'Item 1'},
        {value: 'item2', label: 'Item 2'},
        {value: 'item3', label: 'Item 3'},
      ],
      onChange: jest.fn(),
      value: undefined,
    },
    mappedColumnLabel: 'Item',
    columnLabels: {
      column1: 'Column 1',
      column2: 'Column 2',
    },
    mappedSelectors: {
      column1: {
        choices: [
          ['value1', 'Value 1'],
          ['value2', 'Value 2'],
        ],
        placeholder: 'Select value 1',
      },
      column2: {
        choices: [
          ['valueA', 'Value A'],
          ['valueB', 'Value B'],
        ],
        placeholder: 'Select value 2',
      },
    },
    value: {},
    onChange: mockOnChange,
    onBlur: mockOnBlur,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with empty value showing only the add dropdown', async () => {
    render(<ChoiceMapperField {...defaultProps} />);

    // Should show the add button
    expect(await screen.findByRole('button', {name: /Add Item/i})).toBeInTheDocument();

    // Should not show headers when empty
    expect(screen.queryByText('Column 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Column 2')).not.toBeInTheDocument();
  });

  it('adds a row when selecting an item from the dropdown', async () => {
    render(<ChoiceMapperField {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: /Add Item/i}));

    await userEvent.click(await screen.findByText('Item 1'));

    // Verify onChange was called with new value
    expect(mockOnChange).toHaveBeenCalledWith(
      {
        item1: {column1: null, column2: null},
      },
      {}
    );
  });

  it('removes a row when clicking delete', async () => {
    render(
      <ChoiceMapperField
        {...defaultProps}
        value={{
          item1: {column1: 'value1', column2: 'valueA'},
          item2: {column1: 'value2', column2: 'valueB'},
        }}
      />
    );

    const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
    await userEvent.click(deleteButtons[0]!);

    // Verify onChange was called with item1 removed
    expect(mockOnChange).toHaveBeenCalledWith(
      {
        item2: {column1: 'value2', column2: 'valueB'},
      },
      {}
    );
  });

  it('renders table headers and rows when there are values', async () => {
    render(
      <ChoiceMapperField
        {...defaultProps}
        value={{
          item1: {column1: 'value1', column2: 'valueA'},
        }}
      />
    );

    // Should show headers
    expect(screen.getByText('Column 1')).toBeInTheDocument();
    expect(screen.getByText('Column 2')).toBeInTheDocument();
    expect(screen.getByText('Item')).toBeInTheDocument();

    expect(screen.getByText('Item 1')).toBeInTheDocument();

    await screen.findByRole('button', {name: /Add Item/i});
  });

  describe('AsyncCompactSelectForIntegrationConfig', () => {
    const asyncProps: ComponentProps<typeof ChoiceMapperField> = {
      ...defaultProps,
      addDropdown: {
        items: [],
        url: '/test/search',
        searchField: 'query',
        noResultsMessage: 'No repos found',
        onChange: jest.fn(),
        value: undefined,
      },
    };

    beforeEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('renders async dropdown and fetches results on search', async () => {
      MockApiClient.addMockResponse({
        url: '/test/search',
        body: [
          {value: 'async1', label: 'Async Item 1'},
          {value: 'async2', label: 'Async Item 2'},
        ],
      });

      render(<ChoiceMapperField {...asyncProps} />);

      // Click the add button to open dropdown
      await userEvent.click(screen.getByRole('button', {name: /Add Item/i}));

      // Type in the search box
      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'test');

      // Wait for results to appear
      expect(await screen.findByText('Async Item 1')).toBeInTheDocument();
      expect(screen.getByText('Async Item 2')).toBeInTheDocument();
    });

    it('adds async item and includes label in value', async () => {
      MockApiClient.addMockResponse({
        url: '/test/search',
        body: [
          {value: 'repo123', label: 'my-org/my-repo'},
          {value: 'repo456', label: 'other-org/other-repo'},
        ],
      });

      render(<ChoiceMapperField {...asyncProps} />);

      // Open dropdown
      await userEvent.click(screen.getByRole('button', {name: /Add Item/i}));

      // Search and select
      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'repo');

      await waitFor(() => {
        expect(screen.getByText('my-org/my-repo')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('my-org/my-repo'));

      // Verify onChange was called with label included
      expect(mockOnChange).toHaveBeenCalledWith(
        {
          repo123: {column1: null, column2: null, __label: 'my-org/my-repo'},
        },
        {}
      );
    });

    it('displays async item label in the table', async () => {
      render(
        <ChoiceMapperField
          {...asyncProps}
          value={{
            repo123: {
              column1: 'value1',
              column2: 'valueA',
              __label: 'my-org/my-repo',
            },
          }}
        />
      );

      // Should display the label from __label field
      expect(screen.getByText('my-org/my-repo')).toBeInTheDocument();

      // Wait for any async updates to complete
      await screen.findByRole('button', {name: /Add Item/i});
    });

    it('shows no results message when search returns empty', async () => {
      MockApiClient.addMockResponse({
        url: '/test/search',
        body: [],
      });

      render(<ChoiceMapperField {...asyncProps} />);

      await userEvent.click(screen.getByRole('button', {name: /Add Item/i}));

      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No repos found')).toBeInTheDocument();
      });
    });

    it('filters out already added items from async results', async () => {
      MockApiClient.addMockResponse({
        url: '/test/search',
        body: [
          {value: 'repo123', label: 'my-org/my-repo'},
          {value: 'repo456', label: 'other-org/other-repo'},
        ],
      });

      render(
        <ChoiceMapperField
          {...asyncProps}
          value={{
            repo123: {
              column1: 'value1',
              column2: 'valueA',
              __label: 'my-org/my-repo',
            },
          }}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: /Add Item/i}));

      const searchInput = screen.getByPlaceholderText('Search…');
      await userEvent.type(searchInput, 'repo');

      await waitFor(() => {
        expect(screen.getByText('other-org/other-repo')).toBeInTheDocument();
      });

      const menuItems = screen.getAllByText('my-org/my-repo');

      // Should only be 1 instance (in the table), not in the dropdown
      // 'my-org/my-repo' still appears in the table, just not in the dropdown options
      expect(menuItems).toHaveLength(1);
    });

    it('debounces search queries', async () => {
      const mockRequest = MockApiClient.addMockResponse({
        url: '/test/search',
        body: [{value: 'test', label: 'Test Item'}],
      });

      render(<ChoiceMapperField {...asyncProps} />);

      await userEvent.click(screen.getByRole('button', {name: /Add Item/i}));

      const searchInput = screen.getByRole('textbox');

      await userEvent.type(searchInput, 'test', {delay: 10});

      // Wait for the debounced request and result to appear
      await waitFor(
        () => {
          expect(screen.getByText('Test Item')).toBeInTheDocument();
        },
        {timeout: 1000}
      );

      expect(mockRequest).toHaveBeenCalled();
    });
  });
});
