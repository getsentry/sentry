import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  AndOp,
  GroupOp,
  HeaderCheckOp,
  JsonPathOp,
  NotOp,
  OrOp,
  StatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionOpGroup} from './opGroup';

// Controlled test component that maintains state
function StatefulOpGroup({
  initialValue,
  onRemove,
}: {
  initialValue: GroupOp | NotOp;
  onRemove?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  return <AssertionOpGroup value={value} onChange={setValue} onRemove={onRemove} />;
}

describe('AssertionOpGroup', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();

  const renderRootGroup = async (value: GroupOp | NotOp) => {
    const result = render(
      <AssertionOpGroup value={value} onChange={mockOnChange} root />
    );
    await screen.findByRole('button', {name: 'Add Assertion'});
    return result;
  };

  const renderGroup = async (value: GroupOp | NotOp, onRemove?: () => void) => {
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
      const value: AndOp = {
        id: 'test-id-1',
        op: 'and',
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
      const statusCodeOp: StatusCodeOp = {
        id: 'test-id-1',
        op: 'status_code_check',
        operator: {cmp: 'equals'},
        value: 200,
      };

      const value: AndOp = {
        id: 'test-id-2',
        op: 'and',
        children: [statusCodeOp],
      };

      await renderRootGroup(value);

      expect(screen.getByRole('spinbutton')).toHaveValue(200);
    });

    it('adds operation in root mode', async () => {
      const value: AndOp = {
        id: 'test-id-root',
        op: 'and',
        children: [],
      };

      await renderRootGroup(value);

      await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
      const menuItem = await screen.findByRole('menuitemradio', {name: 'Status Code'});
      await userEvent.click(menuItem);

      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-root',
        op: 'and',
        children: [
          {
            id: expect.any(String),
            op: 'status_code_check',
            operator: {cmp: 'equals'},
            value: 200,
          },
        ],
      });
    });
  });

  describe('non-root mode', () => {
    it('cycles through all group types by clicking', async () => {
      const statusCodeOp: StatusCodeOp = {
        id: 'test-id-1',
        op: 'status_code_check',
        operator: {cmp: 'equals'},
        value: 200,
      };

      // Start with "and" group
      const initialValue: AndOp = {
        id: 'test-id-2',
        op: 'and',
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
      await userEvent.click(screen.getByRole('button', {name: 'Assert Not Any'}));
      await userEvent.click(await screen.findByRole('option', {name: 'Negate result'}));
      await userEvent.click(document.body);

      // Click to change back to "and" group
      await userEvent.click(screen.getByRole('button', {name: 'Assert Any'}));
      await userEvent.click(await screen.findByRole('option', {name: 'Assert All'}));

      // Now negate the "and" group to get "Assert None"
      await userEvent.click(screen.getByRole('button', {name: 'Assert All'}));
      await userEvent.click(await screen.findByRole('option', {name: 'Negate result'}));
      await userEvent.click(document.body);

      // Verify label is "Assert None"
      expect(
        await screen.findByRole('button', {name: 'Assert None'})
      ).toBeInTheDocument();
    });

    it('shows empty state message when no children', async () => {
      const value: AndOp = {
        id: 'test-id-1',
        op: 'and',
        children: [],
      };

      await renderGroup(value);
      expect(screen.getByText('Empty assertion group')).toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', async () => {
      const value: AndOp = {
        id: 'test-id-1',
        op: 'and',
        children: [],
      };

      await renderGroup(value, mockOnRemove);
      await userEvent.click(screen.getByRole('button', {name: 'Remove Group'}));
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });

    it('does not show remove button when onRemove is not provided', async () => {
      const value: AndOp = {
        id: 'test-id-1',
        op: 'and',
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
      const initialValue: AndOp = {
        id: 'test-id-1',
        op: 'and',
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
      expect(await screen.findByRole('spinbutton')).toHaveValue(200);

      // Remove status code
      await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

      // Add JSON path operation
      await userEvent.click(screen.getByRole('button', {name: 'Add assertion to group'}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'JSON Path'})
      );

      // Verify JSON path child rendered
      expect(await screen.findByRole('textbox')).toBeInTheDocument();

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
      const statusCodeOp: StatusCodeOp = {
        id: 'test-id-1',
        op: 'status_code_check',
        operator: {cmp: 'equals'},
        value: 200,
      };

      const value: AndOp = {
        id: 'test-id-2',
        op: 'and',
        children: [statusCodeOp],
      };

      await renderGroup(value);

      // Verify status code input renders with correct value
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(200);
    });

    it('updates json path child', async () => {
      const jsonPathOp: JsonPathOp = {
        id: 'test-id-1',
        op: 'json_path',
        value: '',
      };

      const value: AndOp = {
        id: 'test-id-2',
        op: 'and',
        children: [jsonPathOp],
      };

      await renderGroup(value);

      // Wait for the json path child textbox to render
      const input = await screen.findByRole('textbox');
      await userEvent.type(input, 'x');

      // Verify onChange was called with the updated value
      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-2',
        op: 'and',
        children: [
          {
            id: 'test-id-1',
            op: 'json_path',
            value: 'x',
          },
        ],
      });
    });

    it('updates header child', async () => {
      const headerOp: HeaderCheckOp = {
        id: 'test-id-1',
        op: 'header_check',
        key_op: {cmp: 'equals'},
        key_operand: {header_op: 'literal', value: ''},
        value_op: {cmp: 'equals'},
        value_operand: {header_op: 'literal', value: ''},
      };

      const value: AndOp = {
        id: 'test-id-2',
        op: 'and',
        children: [headerOp],
      };

      await renderGroup(value);

      // Wait for the header child to render
      const keyInput = await screen.findByPlaceholderText('[Empty Header Key]');
      await userEvent.type(keyInput, 'x');

      // Verify onChange was called with the updated value
      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-2',
        op: 'and',
        children: [
          {
            id: 'test-id-1',
            op: 'header_check',
            key_op: {cmp: 'equals'},
            key_operand: {header_op: 'literal', value: 'x'},
            value_op: {cmp: 'equals'},
            value_operand: {header_op: 'literal', value: ''},
          },
        ],
      });
    });
  });

  describe('rendering different child types', () => {
    it('renders all different child types together', async () => {
      const statusCodeOp: StatusCodeOp = {
        id: 'test-id-1',
        op: 'status_code_check',
        operator: {cmp: 'equals'},
        value: 200,
      };

      const jsonPathOp: JsonPathOp = {
        id: 'test-id-2',
        op: 'json_path',
        value: '$.status',
      };

      const headerOp: HeaderCheckOp = {
        id: 'test-id-3',
        op: 'header_check',
        key_op: {cmp: 'equals'},
        key_operand: {header_op: 'literal', value: 'X-Custom'},
        value_op: {cmp: 'equals'},
        value_operand: {header_op: 'literal', value: 'test'},
      };

      const nestedGroup: OrOp = {
        id: 'test-id-4',
        op: 'or',
        children: [],
      };

      const value: AndOp = {
        id: 'test-id-5',
        op: 'and',
        children: [statusCodeOp, jsonPathOp, headerOp, nestedGroup],
      };

      // For nested groups, render directly and wait for multiple buttons
      render(
        <AssertionOpGroup value={value} onChange={mockOnChange} onRemove={mockOnRemove} />
      );

      await screen.findByRole('spinbutton');
      expect(screen.getByRole('spinbutton')).toHaveValue(200);
      expect(screen.getByDisplayValue('$.status')).toBeInTheDocument();
      expect(screen.getByDisplayValue('X-Custom')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Assert Any'})).toBeInTheDocument();
    });
  });

  describe('complex interactions', () => {
    it('updates nested group child', async () => {
      const statusCodeOp: StatusCodeOp = {
        id: 'test-id-1',
        op: 'status_code_check',
        operator: {cmp: 'equals'},
        value: 200,
      };

      const nestedGroup: AndOp = {
        id: 'test-id-2',
        op: 'and',
        children: [statusCodeOp],
      };

      const value: AndOp = {
        id: 'test-id-3',
        op: 'and',
        children: [nestedGroup],
      };

      // For nested groups, render directly and wait for multiple buttons
      render(
        <AssertionOpGroup value={value} onChange={mockOnChange} onRemove={mockOnRemove} />
      );

      // Wait for nested group to render
      await screen.findByRole('spinbutton');

      // Change the nested group type to "or"
      const assertAllButtons = screen.getAllByRole('button', {name: 'Assert All'});
      // Click the nested group button (second one)
      await userEvent.click(assertAllButtons[1]!);
      await userEvent.click(await screen.findByRole('option', {name: 'Assert Any'}));

      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'test-id-3',
        op: 'and',
        children: [
          {
            id: 'test-id-2',
            op: 'or',
            children: [statusCodeOp],
          },
        ],
      });
    });

    it('removes nested group', async () => {
      const nestedGroup: AndOp = {
        id: 'test-id-1',
        op: 'and',
        children: [],
      };

      const value: AndOp = {
        id: 'test-id-2',
        op: 'and',
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
        op: 'and',
        children: [],
      });
    });
  });
});
