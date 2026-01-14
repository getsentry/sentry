import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {StatusCodeOp} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionOpStatusCode} from './opStatusCode';

describe('AssertionOpStatusCode', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();

  const op = 'status_code_check' as const;

  const renderOp = async (value: StatusCodeOp) => {
    const result = render(
      <AssertionOpStatusCode
        value={value}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
      />
    );
    await screen.findByLabelText('Status Code');
    return result;
  };

  const getComparison = (symbol: string) => screen.getByRole('button', {name: symbol});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial value', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: 200,
    });

    expect(screen.getByRole('textbox')).toHaveValue('200');
    expect(getComparison('=')).toBeInTheDocument();
  });

  it('displays equals operator symbol', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});
    expect(getComparison('=')).toBeInTheDocument();
  });

  it('displays not equal operator symbol', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'not_equal'}, value: 200});
    expect(getComparison('\u2260')).toBeInTheDocument();
  });

  it('displays less than operator symbol', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'less_than'}, value: 200});
    expect(getComparison('<')).toBeInTheDocument();
  });

  it('displays greater than operator symbol', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'greater_than'}, value: 200});
    expect(getComparison('>')).toBeInTheDocument();
  });

  it('calls onChange when status code value changes', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '404');

    // Verify onChange was called with correct structure
    expect(mockOnChange).toHaveBeenCalled();
    const lastCall = mockOnChange.mock.calls.at(-1)[0];
    expect(lastCall).toEqual({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: expect.any(Number),
    });
  });

  it('calls onChange when comparison operator changes', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    // Click the operator button to open the dropdown
    await userEvent.click(getComparison('='));

    // Wait for the dropdown to render, then select "less than" option
    await userEvent.click(await screen.findByRole('option', {name: 'less than'}));

    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'less_than'},
      value: 200,
    });
  });

  it('calls onRemove when remove button is clicked', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('clamps status code to valid range (100-599)', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');

    // Test value above max gets clamped to 599
    await userEvent.clear(input);
    await userEvent.type(input, '999');
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({value: 599}));

    jest.clearAllMocks();

    // Test value below min gets clamped to 100
    await userEvent.clear(input);
    await userEvent.type(input, '50');
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({value: 100}));
  });

  it('rejects non-numeric input', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);

    // Clear mocks after clearing input (which triggers onChange with empty value)
    jest.clearAllMocks();

    // Try to type non-numeric characters
    await userEvent.type(input, 'abc');

    // onChange should not be called when non-numeric characters are entered
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('displays all comparison operator options with correct symbols', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    // Click the operator button to open the dropdown
    await userEvent.click(getComparison('='));

    // Wait for dropdown to render, then verify all valid options are present with correct labels and symbols
    const equalsOption = await screen.findByRole('option', {name: 'equal'});
    expect(equalsOption).toBeInTheDocument();
    expect(equalsOption).toHaveTextContent('=');

    const notEqualOption = screen.getByRole('option', {name: 'not equal'});
    expect(notEqualOption).toBeInTheDocument();
    expect(notEqualOption).toHaveTextContent('\u2260');

    const lessThanOption = screen.getByRole('option', {name: 'less than'});
    expect(lessThanOption).toBeInTheDocument();
    expect(lessThanOption).toHaveTextContent('<');

    const greaterThanOption = screen.getByRole('option', {name: 'greater than'});
    expect(greaterThanOption).toBeInTheDocument();
    expect(greaterThanOption).toHaveTextContent('>');

    // These options should NOT be available
    expect(screen.queryByRole('option', {name: 'present'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'not present'})).not.toBeInTheDocument();
  });

  it('preserves value when changing operator', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    // Click the operator button to open the dropdown
    await userEvent.click(getComparison('='));

    // Wait for the dropdown to render, then select "greater than" option
    await userEvent.click(await screen.findByRole('option', {name: 'greater than'}));

    // Value should be preserved
    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'greater_than'},
      value: 200, // Original value preserved
    });
  });
});
