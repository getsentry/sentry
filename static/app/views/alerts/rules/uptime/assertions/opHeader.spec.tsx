import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {HeaderCheckOp} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionOpHeader} from './opHeader';

describe('AssertionOpHeader', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();

  const op = 'header_check' as const;

  const renderOp = async (value: HeaderCheckOp) => {
    const result = render(
      <AssertionOpHeader value={value} onChange={mockOnChange} onRemove={mockOnRemove} />
    );
    await screen.findByLabelText('Header');
    return result;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial key value', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('Content-Type');
  });

  it('renders with empty key value', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: ''},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: ''},
    });

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('');
  });

  it('shows placeholder text for key field', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: ''},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: ''},
    });

    expect(screen.getByPlaceholderText('[Empty Header Key]')).toBeInTheDocument();
  });

  it('calls onChange when key value changes', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: ''},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: ''},
    });

    const keyInput = screen.getByPlaceholderText('[Empty Header Key]');
    await userEvent.type(keyInput, 'a');

    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op: 'header_check',
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'a'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: ''},
    });
  });

  it('calls onRemove when remove button is clicked', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('shows value input when key_op is equals', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    expect(screen.getByPlaceholderText('[Empty Header Value]')).toBeInTheDocument();
  });

  it('hides value input when key_op is always', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'always'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'always'},
      value_operand: {header_op: 'none'},
    });

    // Key input should still be visible
    expect(screen.getByPlaceholderText('[Empty Header Key]')).toBeInTheDocument();
    // Value input should be hidden
    expect(screen.queryByPlaceholderText('[Empty Header Value]')).not.toBeInTheDocument();
  });

  it('handles glob pattern for key', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'glob', pattern: {value: 'X-*'}},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: ''},
    });

    const keyInput = screen.getByPlaceholderText('[Empty Header Key]');
    expect(keyInput).toHaveValue('X-*');
  });

  it('calls onChange when key comparison changes', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    // Find and click the key comparison dropdown button
    const keyComparisonButton = screen.getByRole('button', {name: 'key comparison =""'});
    await userEvent.click(keyComparisonButton);

    // Click on "not equal" option
    await userEvent.click(screen.getByRole('option', {name: 'not equal'}));

    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op: 'header_check',
      key_op: {cmp: 'not_equal'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });
  });

  it('calls onChange when key string type changes from literal to glob', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    // Find and click the key comparison dropdown button
    const keyComparisonButton = screen.getByRole('button', {name: 'key comparison =""'});
    await userEvent.click(keyComparisonButton);

    // Click on "Glob Pattern" option
    await userEvent.click(screen.getByRole('option', {name: 'Glob Pattern'}));

    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op: 'header_check',
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'glob', pattern: {value: 'Content-Type'}},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });
  });

  it('calls onChange with correct value_op when key_op changes from equals to always', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    // Find and click the key comparison dropdown button
    const keyComparisonButton = screen.getByRole('button', {name: 'key comparison =""'});
    await userEvent.click(keyComparisonButton);

    // Click on "present" option (always)
    await userEvent.click(screen.getByRole('option', {name: 'present'}));

    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op: 'header_check',
      key_op: {cmp: 'always'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'always'},
      value_operand: {header_op: 'none'},
    });
  });

  it('calls onChange with correct value_op when key_op changes from always to equals', async () => {
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'always'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'always'},
      value_operand: {header_op: 'none'},
    });

    // Find and click the key comparison dropdown button (should show ⊤ symbol for always)
    const keyComparisonButton = screen.getByRole('button', {name: /key comparison/});
    await userEvent.click(keyComparisonButton);

    // Click on "equal" option
    await userEvent.click(screen.getByRole('option', {name: 'equal'}));

    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op: 'header_check',
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: ''},
    });
  });

  it('preserves key_operand when switching to always (regression test)', async () => {
    // This tests a bug where the string type dropdown would show 'literal' as selected
    // when value_operand was 'none', causing UI inconsistency
    await renderOp({
      id: 'test-id-1',
      op,
      key_op: {cmp: 'equals'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'equals'},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    // Find and click the key comparison dropdown button
    const keyComparisonButton = screen.getByRole('button', {name: 'key comparison =""'});
    await userEvent.click(keyComparisonButton);

    // Click on "present" option (always)
    await userEvent.click(screen.getByRole('option', {name: 'present'}));

    // key_operand should be preserved, value_operand should be set to 'none'
    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op: 'header_check',
      key_op: {cmp: 'always'},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: 'always'},
      value_operand: {header_op: 'none'},
    });
  });
});
