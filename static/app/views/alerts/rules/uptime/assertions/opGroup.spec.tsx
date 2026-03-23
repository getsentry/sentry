import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  UptimeComparisonType,
  UptimeOpType,
  type UptimeAndOp,
  type UptimeGroupOp,
  type UptimeHeaderCheckOp,
  type UptimeJsonPathOp,
  type UptimeNotOp,
  type UptimeOrOp,
  type UptimeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionOpGroup} from './opGroup';

// Controlled test component that maintains state
function StatefulOpGroup({
  initialValue,
  onRemove,
}: {
  initialValue: UptimeGroupOp | UptimeNotOp;
  onRemove?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  return <AssertionOpGroup value={value} onChange={setValue} onRemove={onRemove} />;
}

describe('AssertionOpGroup', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();

  const renderRootGroup = async (value: UptimeGroupOp | UptimeNotOp) => {
    const result = render(
      <AssertionOpGroup value={value} onChange={mockOnChange} root />
    );
    await screen.findByRole('button', {name: 'Add Assertion'});
    return result;
  };

  const renderGroup = async (
    value: UptimeGroupOp | UptimeNotOp,
    onRemove?: () => void
  ) => {
    const result = render(
      <AssertionOpGroup
        value={value}
        onChange={mockOnChange}
        onRemove={onRemove ?? mockOnRemove}
      />
    );
    // Wait for the group to render by checking for the group type button
    await screen.findByRole('button', {name: /Assert (All|Any|None|Not Any)/});
    return result;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('root mode', () => {
    it('renders root group without border controls', async () => {
      const value: UptimeAndOp = {
        id: 'test-id-1',
        op: UptimeOpType.AND,
        children: [],
      };

      await renderRootGroup(value);

      // Should show the "Add Assertion" button
      expect(screen.getByRole('button', {name: 'Add Assertion'})).toBeInTheDocument();

      // Should NOT show group type selector or remove button (root mode)
      expect(screen.queryByRole('button', {name: 'Assert All'})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Remove Group'})
      ).not.toBeInTheDocument();
    });

    it('renders children in root mode', async () => {
      const statusCodeOp: UptimeStatusCodeOp = {
        id: 'test-id-1',
        op: UptimeOpType.STATUS_CODE_CHECK,
        operator: {cmp: UptimeComparisonType.EQUALS},
        value: 200,
      };

      const value: UptimeAndOp = {
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [statusCodeOp],
      };

      await renderRootGroup(value);

      expect(screen.getByRole('textbox')).toHaveValue('200');
    });

    it('adds operation in root mode', async () => {
      const value: UptimeAndOp = {
        id: 'test-id-root',
        op: UptimeOpType.AND,
        children: [],
      };

      await renderRootGroup(value);

      await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
      const menuItem = await screen.findByRole('menuitemradio', {name: 'Status Code'});
      await userEvent.click(menuItem);

      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-root',
        op: UptimeOpType.AND,
        children: [
          {
            id: expect.any(String),
            op: UptimeOpType.STATUS_CODE_CHECK,
            operator: {cmp: UptimeComparisonType.EQUALS},
            value: 200,
          },
        ],
      });
    });
  });

  describe('non-root mode', () => {
    it('cycles through all group types by clicking', async () => {
      const statusCodeOp: UptimeStatusCodeOp = {
        id: 'test-id-1',
        op: UptimeOpType.STATUS_CODE_CHECK,
        operator: {cmp: UptimeComparisonType.EQUALS},
        value: 200,
      };

      // Start with "and" group
      const initialValue: UptimeAndOp = {
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [statusCodeOp],
      };

      render(<StatefulOpGroup initialValue={initialValue} />);
      await screen.findByRole('button', {name: 'Assert All'});

      // Click to change to "or" group
      await userEvent.click(screen.getByRole('button', {name: 'Assert All'}));
      await userEvent.click(await screen.findByRole('option', {name: 'Assert Any'}));

      // Click to add negation
      await userEvent.click(screen.getByRole('button', {name: 'Assert Any'}));
      await userEvent.click(await screen.findByRole('option', {name: 'Negate result'}));
      await userEvent.click(document.body);

      // Click to remove negation (same "Negate result" option toggles it off)
      await userEvent.click(screen.getByRole('button', {name: 'Assert None'}));
      await userEvent.click(await screen.findByRole('option', {name: 'Negate result'}));
      await userEvent.click(document.body);

      // Click to change back to "and" group
      await userEvent.click(screen.getByRole('button', {name: 'Assert Any'}));
      await userEvent.click(await screen.findByRole('option', {name: 'Assert All'}));

      // Now negate the "and" group to get "Assert None"
      await userEvent.click(screen.getByRole('button', {name: 'Assert All'}));
      await userEvent.click(await screen.findByRole('option', {name: 'Negate result'}));
      await userEvent.click(document.body);

      // Verify label is "Assert Not All"
      expect(
        await screen.findByRole('button', {name: 'Assert Not All'})
      ).toBeInTheDocument();
    });

    it('shows empty state message when no children', async () => {
      const value: UptimeAndOp = {
        id: 'test-id-1',
        op: UptimeOpType.AND,
        children: [],
      };

      await renderGroup(value);
      expect(screen.getByText('Empty assertion group')).toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', async () => {
      const value: UptimeAndOp = {
        id: 'test-id-1',
        op: UptimeOpType.AND,
        children: [],
      };

      await renderGroup(value, mockOnRemove);
      await userEvent.click(screen.getByRole('button', {name: 'Remove Group'}));
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });

    it('does not show remove button when onRemove is not provided', async () => {
      const value: UptimeAndOp = {
        id: 'test-id-1',
        op: UptimeOpType.AND,
        children: [],
      };

      render(<AssertionOpGroup value={value} onChange={mockOnChange} />);
      await screen.findByRole('button', {name: 'Assert All'});

      expect(
        screen.queryByRole('button', {name: 'Remove Group'})
      ).not.toBeInTheDocument();
    });
  });

  describe('adding and removing children', () => {
    it('cycles through adding and removing different operation types', async () => {
      const initialValue: UptimeAndOp = {
        id: 'test-id-1',
        op: UptimeOpType.AND,
        children: [],
      };

      render(<StatefulOpGroup initialValue={initialValue} />);
      await screen.findByRole('button', {name: 'Assert All'});

      expect(screen.getByText('Empty assertion group')).toBeInTheDocument();

      // Add status code operation
      await userEvent.click(screen.getByRole('button', {name: 'Add assertion to group'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Status Code'})
      );

      // Verify status code child rendered
      expect(await screen.findByRole('textbox')).toHaveValue('200');

      // Remove status code
      await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

      // Add JSON path operation
      await userEvent.click(screen.getByRole('button', {name: 'Add assertion to group'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'JSON Path'})
      );

      // Verify JSON path child rendered
      expect(await screen.findByTestId('json-path-value-input')).toBeInTheDocument();

      // Remove JSON path
      await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

      // Add header operation
      await userEvent.click(screen.getByRole('button', {name: 'Add assertion to group'}));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Header'}));

      // Remove header
      await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

      // Add nested group
      await userEvent.click(screen.getByRole('button', {name: 'Add assertion to group'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Logical Group'})
      );

      // Verify nested group rendered (parent + nested = 2 "Assert All" buttons)
      const assertAllButtons = await screen.findAllByRole('button', {name: 'Assert All'});
      expect(assertAllButtons).toHaveLength(2);

      // Remove nested group
      const removeButtons = screen.getAllByRole('button', {name: 'Remove Group'});
      await userEvent.click(removeButtons[1]!); // [0] = parent, [1] = nested group child
    });
  });

  describe('updating children', () => {
    it('renders status code child', async () => {
      const statusCodeOp: UptimeStatusCodeOp = {
        id: 'test-id-1',
        op: UptimeOpType.STATUS_CODE_CHECK,
        operator: {cmp: UptimeComparisonType.EQUALS},
        value: 200,
      };

      const value: UptimeAndOp = {
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [statusCodeOp],
      };

      await renderGroup(value);

      // Verify status code input renders with correct value
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('200');
    });

    it('updates json path child', async () => {
      const jsonPathOp: UptimeJsonPathOp = {
        id: 'test-id-1',
        op: UptimeOpType.JSON_PATH,
        value: '',
        operator: {cmp: UptimeComparisonType.EQUALS},
        operand: {jsonpath_op: 'literal', value: ''},
      };

      const value: UptimeAndOp = {
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [jsonPathOp],
      };

      await renderGroup(value);

      // Wait for the json path child input to render
      const input = screen.getByTestId('json-path-value-input');
      await userEvent.type(input, 'x');

      // Verify onChange was called with the updated value
      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [
          {
            id: 'test-id-1',
            op: UptimeOpType.JSON_PATH,
            value: 'x',
            operator: {cmp: UptimeComparisonType.EQUALS},
            operand: {jsonpath_op: 'literal', value: ''},
          },
        ],
      });
    });

    it('updates header child', async () => {
      const headerOp: UptimeHeaderCheckOp = {
        id: 'test-id-1',
        op: UptimeOpType.HEADER_CHECK,
        key_op: {cmp: UptimeComparisonType.EQUALS},
        key_operand: {header_op: 'literal', value: ''},
        value_op: {cmp: UptimeComparisonType.EQUALS},
        value_operand: {header_op: 'literal', value: ''},
      };

      const value: UptimeAndOp = {
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [headerOp],
      };

      await renderGroup(value);

      // Wait for the header child to render
      const keyInput = await screen.findByPlaceholderText('[Empty Header Key]');
      await userEvent.type(keyInput, 'x');

      // Verify onChange was called with the updated value
      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [
          {
            id: 'test-id-1',
            op: UptimeOpType.HEADER_CHECK,
            key_op: {cmp: UptimeComparisonType.EQUALS},
            key_operand: {header_op: 'literal', value: 'x'},
            value_op: {cmp: UptimeComparisonType.EQUALS},
            value_operand: {header_op: 'literal', value: ''},
          },
        ],
      });
    });
  });

  describe('rendering different child types', () => {
    it('renders all different child types together', async () => {
      const statusCodeOp: UptimeStatusCodeOp = {
        id: 'test-id-1',
        op: UptimeOpType.STATUS_CODE_CHECK,
        operator: {cmp: UptimeComparisonType.EQUALS},
        value: 200,
      };

      const jsonPathOp: UptimeJsonPathOp = {
        id: 'test-id-2',
        op: UptimeOpType.JSON_PATH,
        value: '$.status',
        operator: {cmp: UptimeComparisonType.EQUALS},
        operand: {jsonpath_op: 'literal', value: ''},
      };

      const headerOp: UptimeHeaderCheckOp = {
        id: 'test-id-3',
        op: UptimeOpType.HEADER_CHECK,
        key_op: {cmp: UptimeComparisonType.EQUALS},
        key_operand: {header_op: 'literal', value: 'X-Custom'},
        value_op: {cmp: UptimeComparisonType.EQUALS},
        value_operand: {header_op: 'literal', value: 'test'},
      };

      const nestedGroup: UptimeOrOp = {
        id: 'test-id-4',
        op: UptimeOpType.OR,
        children: [],
      };

      const value: UptimeAndOp = {
        id: 'test-id-5',
        op: UptimeOpType.AND,
        children: [statusCodeOp, jsonPathOp, headerOp, nestedGroup],
      };

      // For nested groups, render directly and wait for multiple buttons
      render(
        <AssertionOpGroup value={value} onChange={mockOnChange} onRemove={mockOnRemove} />
      );

      await screen.findByDisplayValue('200');
      expect(screen.getByDisplayValue('200')).toBeInTheDocument();
      expect(screen.getByDisplayValue('$.status')).toBeInTheDocument();
      expect(screen.getByDisplayValue('X-Custom')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Assert Any'})).toBeInTheDocument();
    });
  });

  describe('complex interactions', () => {
    it('updates nested group child', async () => {
      const statusCodeOp: UptimeStatusCodeOp = {
        id: 'test-id-1',
        op: UptimeOpType.STATUS_CODE_CHECK,
        operator: {cmp: UptimeComparisonType.EQUALS},
        value: 200,
      };

      const nestedGroup: UptimeAndOp = {
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [statusCodeOp],
      };

      const value: UptimeAndOp = {
        id: 'test-id-3',
        op: UptimeOpType.AND,
        children: [nestedGroup],
      };

      // For nested groups, render directly and wait for multiple buttons
      render(
        <AssertionOpGroup value={value} onChange={mockOnChange} onRemove={mockOnRemove} />
      );

      // Wait for nested group to render
      await screen.findByDisplayValue('200');

      // Change the nested group type to "or"
      const assertAllButtons = screen.getAllByRole('button', {name: 'Assert All'});
      // Click the nested group button (second one)
      await userEvent.click(assertAllButtons[1]!);
      await userEvent.click(await screen.findByRole('option', {name: 'Assert Any'}));

      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-3',
        op: UptimeOpType.AND,
        children: [
          {
            id: 'test-id-2',
            op: UptimeOpType.OR,
            children: [statusCodeOp],
          },
        ],
      });
    });

    it('removes nested group', async () => {
      const nestedGroup: UptimeAndOp = {
        id: 'test-id-1',
        op: UptimeOpType.AND,
        children: [],
      };

      const value: UptimeAndOp = {
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [nestedGroup],
      };

      // For nested groups, render directly and wait for multiple buttons
      render(
        <AssertionOpGroup value={value} onChange={mockOnChange} onRemove={mockOnRemove} />
      );

      // Wait for nested group to render - should have 2 "Assert All" buttons (parent + nested)
      const assertAllButtons = await screen.findAllByRole('button', {name: 'Assert All'});
      expect(assertAllButtons).toHaveLength(2);

      // Get all remove buttons, click the nested group's remove button
      // Button order: [0] = parent group, [1] = nested group child
      const removeButtons = screen.getAllByRole('button', {name: 'Remove Group'});
      await userEvent.click(removeButtons[1]!);

      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-2',
        op: UptimeOpType.AND,
        children: [],
      });
    });
  });
});
