import {useState} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {JsonPathOp} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionsDndContext} from './dragDrop';
import {AssertionOpJsonPath} from './opJsonPath';

describe('AssertionOpJsonPath', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();

  const op = 'json_path' as const;
  const defaultOperator = {cmp: 'equals'} as const;
  const defaultOperand = {jsonpath_op: 'literal', value: 'ok'} as const;

  const renderOp = async (value: JsonPathOp) => {
    const result = render(
      <AssertionOpJsonPath
        value={value}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
      />
    );
    // Wait for the labeled input to mount to avoid act() warnings from underlying refs.
    await screen.findByLabelText('JSON Path');
    return result;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial value', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '$.status',
      operator: defaultOperator,
      operand: defaultOperand,
    });

    expect(screen.getAllByRole('textbox')[0]).toHaveValue('$.status');
  });

  it('renders with empty value', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '',
      operator: defaultOperator,
      operand: defaultOperand,
    });

    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
  });

  it('shows placeholder text', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '',
      operator: defaultOperator,
      operand: defaultOperand,
    });

    expect(screen.getByPlaceholderText('$.status')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ok')).toBeInTheDocument();
  });

  it('calls onChange when value changes', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '',
      operator: defaultOperator,
      operand: defaultOperand,
    });

    const input = screen.getByPlaceholderText('$.status');
    await userEvent.type(input, 'a');

    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op: 'json_path',
      value: 'a',
      operator: defaultOperator,
      operand: defaultOperand,
    });
  });

  it('calls onChange when operand value changes', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '$.status',
      operator: defaultOperator,
      operand: defaultOperand,
    });

    const operandInput = screen.getByLabelText('JSON path expected value');
    await userEvent.type(operandInput, 'z');

    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op: 'json_path',
      value: '$.status',
      operator: defaultOperator,
      operand: {jsonpath_op: 'literal', value: 'okz'},
    });
  });

  it('calls onRemove when remove button is clicked', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '$.status',
      operator: defaultOperator,
      operand: defaultOperand,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('has tooltip with link to RFC', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '$.status',
      operator: defaultOperator,
      operand: defaultOperand,
    });

    // Hover over the question mark icon to show tooltip
    const questionIcon = screen.getByTestId('more-information');
    await userEvent.hover(questionIcon);

    // Check that tooltip appears with the link
    const link = await screen.findByRole('link', {name: 'JSON Path RFC'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.rfc-editor.org/rfc/rfc9535.html');
  });

  it('renders drag handle for reordering', async () => {
    render(
      <AssertionsDndContext>
        <AssertionOpJsonPath
          value={{
            id: 'test-id-1',
            op,
            value: '$.status',
            operator: defaultOperator,
            operand: defaultOperand,
          }}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      </AssertionsDndContext>
    );

    await screen.findByLabelText('JSON Path');
    expect(screen.getByRole('button', {name: 'Reorder assertion'})).toBeInTheDocument();
  });

  it('hides < and > comparisons for non-numeric operand values', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '$.status',
      operator: defaultOperator,
      operand: {jsonpath_op: 'literal', value: 'ok'},
    });

    const comparisonButton = screen.getByRole('button', {
      name: 'JSON path comparison =""',
    });
    await userEvent.click(comparisonButton);

    expect(screen.queryByRole('option', {name: 'less than'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'greater than'})).not.toBeInTheDocument();
  });

  it('allows < and > comparisons for numeric operand values and hides string type selector', async () => {
    function Stateful() {
      const [state, setState] = useState<JsonPathOp>({
        id: 'test-id-1',
        op,
        value: '$.status',
        operator: defaultOperator,
        operand: defaultOperand,
      });
      return (
        <AssertionOpJsonPath
          value={state}
          onChange={next => {
            mockOnChange(next);
            setState(next);
          }}
          onRemove={mockOnRemove}
        />
      );
    }

    render(<Stateful />);
    await screen.findByLabelText('JSON Path');

    const operandInput = screen.getByLabelText('JSON path expected value');
    await userEvent.clear(operandInput);
    await userEvent.type(operandInput, '123');

    const comparisonButton = screen.getByRole('button', {
      name: 'JSON path comparison =""',
    });
    await userEvent.click(comparisonButton);

    expect(screen.getByRole('option', {name: 'less than'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'greater than'})).toBeInTheDocument();

    // Numeric mode forces literal and hides the string type region, so these options shouldn't appear.
    expect(screen.queryByRole('option', {name: 'Glob Pattern'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Literal'})).not.toBeInTheDocument();
  });

  it('resets operator from < or > to equals when the operand is not numeric', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      value: '$.status',
      operator: {cmp: 'less_than'},
      operand: defaultOperand,
    });

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-1',
        op: 'json_path',
        value: '$.status',
        operator: {cmp: 'equals'},
        operand: defaultOperand,
      })
    );
  });
});
