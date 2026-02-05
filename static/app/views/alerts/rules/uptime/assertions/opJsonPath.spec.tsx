import {useState} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {
  Comparison,
  JsonPathOp,
  JsonPathOperand,
} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionsDndContext} from './dragDrop';
import {AssertionOpJsonPath} from './opJsonPath';
import {makeJsonPathOp} from './testUtils';

describe('AssertionOpJsonPath', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();

  const defaultOperator: Comparison = {cmp: 'equals'};
  const defaultOperand: JsonPathOperand = {jsonpath_op: 'literal', value: 'ok'};

  const renderOp = async (value: JsonPathOp) => {
    const result = render(
      <AssertionOpJsonPath
        value={value}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
      />
    );
    // Wait for the labeled input to mount to avoid act() warnings from underlying refs.
    await screen.findByTestId('json-path-value-input');
    return result;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders placeholder text', async () => {
    await renderOp(
      makeJsonPathOp({
        value: '',
        operand: {jsonpath_op: 'literal', value: ''},
      })
    );

    expect(screen.getByPlaceholderText('$.status')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ok')).toBeInTheDocument();
  });

  it('calls onChange when value changes', async () => {
    await renderOp(
      makeJsonPathOp({
        id: 'test-id-1',
        value: '',
        operator: defaultOperator,
        operand: defaultOperand,
      })
    );

    const input = screen.getByTestId('json-path-value-input');
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
    await renderOp(
      makeJsonPathOp({
        id: 'test-id-1',
        value: '$.status',
        operator: defaultOperator,
        operand: {jsonpath_op: 'literal', value: ''},
      })
    );

    const operandInput = screen.getByTestId('json-path-operand-value');
    await userEvent.type(operandInput, 'a');

    expect(mockOnChange).toHaveBeenLastCalledWith({
      id: 'test-id-1',
      op: 'json_path',
      value: '$.status',
      operator: defaultOperator,
      operand: {jsonpath_op: 'literal', value: 'a'},
    });
  });

  it('calls onRemove when remove button is clicked', async () => {
    await renderOp(makeJsonPathOp());

    await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('has tooltip with link to RFC', async () => {
    await renderOp(makeJsonPathOp());

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
          value={makeJsonPathOp()}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      </AssertionsDndContext>
    );

    await screen.findByTestId('json-path-value-input');
    expect(screen.getByRole('button', {name: 'Reorder assertion'})).toBeInTheDocument();
  });

  it('hides < and > comparisons for non-numeric operand values', async () => {
    await renderOp(
      makeJsonPathOp({
        operand: {jsonpath_op: 'literal', value: 'ok'},
      })
    );

    const comparisonButton = screen.getByTestId('json-path-operators-trigger');
    await userEvent.click(comparisonButton);

    expect(screen.queryByRole('option', {name: 'less than'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'greater than'})).not.toBeInTheDocument();
  });

  it('allows < and > comparisons for numeric operand values and hides string type selector', async () => {
    function Stateful() {
      const [state, setState] = useState<JsonPathOp>({
        ...makeJsonPathOp({
          operator: defaultOperator,
          operand: defaultOperand,
        }),
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
    await screen.findByTestId('json-path-value-input');

    const operandInput = screen.getByTestId('json-path-operand-value');
    await userEvent.clear(operandInput);
    await userEvent.type(operandInput, '123');

    const comparisonButton = screen.getByTestId('json-path-operators-trigger');
    await userEvent.click(comparisonButton);

    expect(screen.getByRole('option', {name: 'less than'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'greater than'})).toBeInTheDocument();

    expect(screen.queryByRole('option', {name: 'Glob Pattern'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Literal'})).not.toBeInTheDocument();
  });

  it('resets operator from < or > to equals when the operand is not numeric', async () => {
    await renderOp(
      makeJsonPathOp({
        id: 'test-id-1',
        value: '$.status',
        operator: {cmp: 'less_than'},
        operand: defaultOperand,
      })
    );

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

  it('renders safely when given a legacy op without operator or operand', async () => {
    await renderOp({
      id: 'test-id-1',
      op: 'json_path',
      value: '$.status',
    } as JsonPathOp);

    // Should render with safe defaults (equals + literal) instead of crashing.
    expect(screen.getByTestId('json-path-value-input')).toHaveValue('$.status');
    expect(screen.getByTestId('json-path-operand-value')).toHaveValue('');
    expect(screen.getByTestId('json-path-operators-trigger')).toHaveTextContent('=""');
  });
});
