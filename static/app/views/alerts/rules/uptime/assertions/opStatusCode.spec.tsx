import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {StatusCodeOp} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionsDndContext} from './dragDrop';
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

  // Stateful wrapper for testing controlled component behavior properly
  function StatefulWrapper({
    initialValue,
    onChangeSpy,
    onRemoveSpy,
  }: {
    initialValue: StatusCodeOp;
    onChangeSpy: jest.Mock;
    onRemoveSpy: jest.Mock;
  }) {
    const [value, setValue] = useState(initialValue);
    return (
      <AssertionOpStatusCode
        value={value}
        onChange={newValue => {
          setValue(newValue);
          onChangeSpy(newValue);
        }}
        onRemove={onRemoveSpy}
      />
    );
  }

  const renderStatefulOp = async (initialValue: StatusCodeOp) => {
    const result = render(
      <StatefulWrapper
        initialValue={initialValue}
        onChangeSpy={mockOnChange}
        onRemoveSpy={mockOnRemove}
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
    await renderStatefulOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '404');

    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: 404,
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

  it('uses numeric input mode for mobile keyboards', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Not an input');
    }

    expect(input.inputMode).toBe('numeric');
    expect(input.pattern).toBe('[0-9]*');
  });

  it('allows typing status codes without immediate clamping', async () => {
    await renderStatefulOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);

    // Typing "5" should NOT be clamped to 100
    await userEvent.type(input, '5');
    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: 5,
    });

    // Continue typing "04" to make "504" (intermediate values allowed)
    await userEvent.type(input, '04');
    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: 504,
    });
  });

  it('clamps value to min on blur when below range', async () => {
    await renderStatefulOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '50');
    mockOnChange.mockClear();

    // Blur should clamp to min
    await userEvent.tab();

    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: 100,
    });
  });

  it('clamps value immediately when typing 3 digits above range', async () => {
    await renderStatefulOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '700');

    // Value should be clamped to 599 immediately on the third keystroke
    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: 599,
    });
  });

  it('rejects non-numeric input', async () => {
    await renderOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'abc');

    // onChange should not be called (non-numeric rejected)
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('resets to min on blur when controlled value is invalid', async () => {
    await renderStatefulOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 50});

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.tab();

    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: 100,
    });
  });

  it('resets to default when input is cleared and blurred', async () => {
    await renderStatefulOp({id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200});

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    mockOnChange.mockClear();

    await userEvent.tab();

    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op,
      operator: {cmp: 'equals'},
      value: 200,
    });
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

  it('renders drag handle for reordering', async () => {
    render(
      <AssertionsDndContext>
        <AssertionOpStatusCode
          value={{id: 'test-id-1', op, operator: {cmp: 'equals'}, value: 200}}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      </AssertionsDndContext>
    );

    await screen.findByLabelText('Status Code');
    expect(screen.getByRole('button', {name: 'Reorder assertion'})).toBeInTheDocument();
  });
});
