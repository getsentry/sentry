import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AddOpButton} from './addOpButton';

describe('AddOpButton', () => {
  const mockOnAddOp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dropdown with correct trigger label', () => {
    render(<AddOpButton onAddOp={mockOnAddOp} triggerLabel="Hello Assertions" />);

    // The aria-label is hardcoded to 'Add Assertion' in the component
    const button = screen.getByRole('button', {name: 'Add Assertion'});
    expect(button).toBeInTheDocument();

    // But the visible text should be from triggerLabel
    expect(button).toHaveTextContent('Hello Assertions');
  });

  it('renders all menu items with correct labels and descriptions', async () => {
    render(<AddOpButton onAddOp={mockOnAddOp} triggerLabel="Add" />);

    await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));

    // Wait for menu to open
    expect(await screen.findByRole('menu')).toBeInTheDocument();

    // Verify all menu items are present with correct accessible descriptions
    const statusCodeItem = screen.getByRole('menuitemradio', {name: 'Status Code'});
    expect(statusCodeItem).toBeInTheDocument();
    expect(statusCodeItem).toHaveAccessibleDescription('Check HTTP response status code');

    const jsonPathItem = screen.getByRole('menuitemradio', {name: 'JSON Path'});
    expect(jsonPathItem).toBeInTheDocument();
    expect(jsonPathItem).toHaveAccessibleDescription(
      'Validate JSON response body content'
    );

    const headerItem = screen.getByRole('menuitemradio', {name: 'Header'});
    expect(headerItem).toBeInTheDocument();
    expect(headerItem).toHaveAccessibleDescription('Check HTTP response header values');

    const groupItem = screen.getByRole('menuitemradio', {name: 'Logical Group'});
    expect(groupItem).toBeInTheDocument();
    expect(groupItem).toHaveAccessibleDescription(
      'Combine multiple assertions with AND/OR logic'
    );
  });

  describe('adding assertions', () => {
    it('calls onAddOp with correct StatusCodeOp when Status Code is selected', async () => {
      render(<AddOpButton onAddOp={mockOnAddOp} triggerLabel="Add" />);

      await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Status Code'})
      );

      expect(mockOnAddOp).toHaveBeenCalledWith({
        id: expect.any(String),
        op: 'status_code_check',
        operator: {cmp: 'equals'},
        value: 200,
      });
    });

    it('calls onAddOp with correct JsonPathOp when JSON Path is selected', async () => {
      render(<AddOpButton onAddOp={mockOnAddOp} triggerLabel="Add" />);

      await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'JSON Path'})
      );

      expect(mockOnAddOp).toHaveBeenCalledWith({
        id: expect.any(String),
        op: 'json_path',
        value: '',
      });
    });

    it('calls onAddOp with correct HeaderCheckOp when Header is selected', async () => {
      render(<AddOpButton onAddOp={mockOnAddOp} triggerLabel="Add" />);

      await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Header'}));

      expect(mockOnAddOp).toHaveBeenCalledWith({
        id: expect.any(String),
        op: 'header_check',
        key_op: {cmp: 'equals'},
        key_operand: {header_op: 'literal', value: ''},
        value_op: {cmp: 'equals'},
        value_operand: {header_op: 'literal', value: ''},
      });
    });

    it('calls onAddOp with correct AndOp when Logical Group is selected', async () => {
      render(<AddOpButton onAddOp={mockOnAddOp} triggerLabel="Add" />);

      await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Logical Group'})
      );

      expect(mockOnAddOp).toHaveBeenCalledWith({
        id: expect.any(String),
        op: 'and',
        children: [],
      });
    });

    it('generates unique IDs for each operation', async () => {
      render(<AddOpButton onAddOp={mockOnAddOp} triggerLabel="Add" />);

      // Add status code op
      await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Status Code'})
      );

      expect(mockOnAddOp).toHaveBeenNthCalledWith(1, {
        id: expect.any(String),
        op: 'status_code_check',
        operator: {cmp: 'equals'},
        value: 200,
      });

      const firstId = mockOnAddOp.mock.calls[0][0].id;

      // Add another status code op
      await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Status Code'})
      );

      expect(mockOnAddOp).toHaveBeenNthCalledWith(2, {
        id: expect.any(String),
        op: 'status_code_check',
        operator: {cmp: 'equals'},
        value: 200,
      });

      const secondId = mockOnAddOp.mock.calls[1][0].id;

      // IDs should be unique
      expect(firstId).not.toBe(secondId);
    });
  });
});
