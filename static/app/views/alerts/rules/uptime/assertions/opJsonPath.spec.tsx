import {useState} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  UptimeComparisonType,
  UptimeOpType,
  type UptimeComparison,
  type UptimeJsonPathOp,
  type UptimeJsonPathOperand,
} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionsDndContext} from './dragDrop';
import {AssertionOpJsonPath} from './opJsonPath';
import {makeJsonPathOp} from './testUtils';

describe('AssertionOpJsonPath', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();

  const defaultOperator: UptimeComparison = {cmp: UptimeComparisonType.EQUALS};
  const defaultOperand: UptimeJsonPathOperand = {jsonpath_op: 'literal', value: 'ok'};

  const renderOp = async (value: UptimeJsonPathOp) => {
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
      op: UptimeOpType.JSON_PATH,
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
      op: UptimeOpType.JSON_PATH,
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

  it('shows < and > comparisons as disabled for non-numeric operand values', async () => {
    await renderOp(
      makeJsonPathOp({
        operand: {jsonpath_op: 'literal', value: 'ok'},
      })
    );

    const comparisonButton = screen.getByTestId('json-path-operators-trigger');
    await userEvent.click(comparisonButton);

    const lessThan = screen.getByRole('option', {name: 'less than'});
    const greaterThan = screen.getByRole('option', {name: 'greater than'});

    expect(lessThan).toBeInTheDocument();
    expect(greaterThan).toBeInTheDocument();
    expect(lessThan).toHaveAttribute('aria-disabled', 'true');
    expect(greaterThan).toHaveAttribute('aria-disabled', 'true');
  });

  it('enables < and > comparisons for numeric operand values', async () => {
    function Stateful() {
      const [state, setState] = useState<UptimeJsonPathOp>({
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

    const lessThan = screen.getByRole('option', {name: 'less than'});
    const greaterThan = screen.getByRole('option', {name: 'greater than'});

    expect(lessThan).toBeInTheDocument();
    expect(greaterThan).toBeInTheDocument();
    expect(lessThan).not.toHaveAttribute('aria-disabled', 'true');
    expect(greaterThan).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows string operand types as disabled when < or > comparison is selected', async () => {
    await renderOp(
      makeJsonPathOp({
        operator: {cmp: UptimeComparisonType.LESS_THAN},
        operand: {jsonpath_op: 'literal', value: '123'},
      })
    );

    const comparisonButton = screen.getByTestId('json-path-operators-trigger');
    await userEvent.click(comparisonButton);

    const globPattern = screen.getByRole('option', {name: 'Glob Pattern'});
    const literal = screen.getByRole('option', {name: 'Literal'});

    expect(globPattern).toBeInTheDocument();
    expect(literal).toBeInTheDocument();
    expect(globPattern).toHaveAttribute('aria-disabled', 'true');
    expect(literal).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows string operand types as enabled when = or ≠ comparison is selected', async () => {
    await renderOp(
      makeJsonPathOp({
        operator: defaultOperator,
        operand: {jsonpath_op: 'literal', value: 'ok'},
      })
    );

    const comparisonButton = screen.getByTestId('json-path-operators-trigger');
    await userEvent.click(comparisonButton);

    const globPattern = screen.getByRole('option', {name: 'Glob Pattern'});
    const literal = screen.getByRole('option', {name: 'Literal'});

    expect(globPattern).toBeInTheDocument();
    expect(literal).toBeInTheDocument();
    expect(globPattern).not.toHaveAttribute('aria-disabled', 'true');
    expect(literal).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('resets operator from < or > to equals when the operand is not numeric', async () => {
    await renderOp(
      makeJsonPathOp({
        id: 'test-id-1',
        value: '$.status',
        operator: {cmp: UptimeComparisonType.LESS_THAN},
        operand: defaultOperand,
      })
    );

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-1',
        op: UptimeOpType.JSON_PATH,
        value: '$.status',
        operator: {cmp: UptimeComparisonType.EQUALS},
        operand: defaultOperand,
      })
    );
  });

  it('resets glob operand to literal when < or > comparison is selected', async () => {
    function Stateful() {
      const [state, setState] = useState<UptimeJsonPathOp>(
        makeJsonPathOp({
          id: 'test-id-1',
          value: '$.count',
          operator: defaultOperator,
          operand: {jsonpath_op: 'glob', pattern: {value: '123'}},
        })
      );
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

    const comparisonButton = screen.getByTestId('json-path-operators-trigger');
    await userEvent.click(comparisonButton);

    const lessThan = screen.getByRole('option', {name: 'less than'});
    await userEvent.click(lessThan);

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenLastCalledWith({
        id: 'test-id-1',
        op: UptimeOpType.JSON_PATH,
        value: '$.count',
        operator: {cmp: UptimeComparisonType.LESS_THAN},
        operand: {jsonpath_op: 'literal', value: '123'},
      })
    );
  });

  it('renders safely when given a legacy op without operator or operand', async () => {
    await renderOp({
      id: 'test-id-1',
      op: UptimeOpType.JSON_PATH,
      value: '$.status',
    } as UptimeJsonPathOp);

    // Should render with safe defaults (equals + literal) instead of crashing.
    expect(screen.getByTestId('json-path-value-input')).toHaveValue('$.status');
    expect(screen.getByTestId('json-path-operand-value')).toHaveValue('');
    expect(screen.getByTestId('json-path-operators-trigger')).toHaveTextContent('=""');
  });
});
// trivial change for CI testing
