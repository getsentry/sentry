import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {
  ComparisonType,
  OpType,
  type AndOp,
  type Assertion,
  type StatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {normalizeAssertion, UptimeAssertionsField} from './field';

describe('UptimeAssertionsField', () => {
  const mockSubmit = jest.fn();
  let model: FormModel;

  beforeEach(() => {
    model = new FormModel();
    jest.clearAllMocks();
  });

  it('renders with Form context and builds an assertion', async () => {
    render(
      <Form onSubmit={mockSubmit} model={model}>
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Should render the Add Assertion button (from AssertionOpGroup in root mode)
    expect(screen.getByRole('button', {name: 'Add Assertion'})).toBeInTheDocument();

    // Default state should have two status code assertions (>199 AND <300)
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes).toHaveLength(2);
    expect(textboxes[0]).toHaveValue('199');
    expect(textboxes[1]).toHaveValue('300');

    // Click to add another assertion
    await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));

    // Should show the assertion type menu
    expect(await screen.findByRole('menu')).toBeInTheDocument();

    // Add a status code assertion
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Status Code'}));

    // Should now have 3 status code inputs
    expect(await screen.findAllByRole('textbox')).toHaveLength(3);

    // Verify the model has been updated with the assertion structure
    const fieldValue = model.fields.get('assertion') as unknown as Assertion;
    expect(fieldValue).toMatchObject({
      root: {
        op: OpType.AND,
        children: [
          {op: OpType.STATUS_CODE_CHECK},
          {op: OpType.STATUS_CODE_CHECK},
          {op: OpType.STATUS_CODE_CHECK},
        ],
      },
    });
  });

  it('renders existing assertion from initialData', async () => {
    const existingAssertion: Assertion = {
      root: {
        id: 'root-1',
        op: OpType.AND,
        children: [
          {
            id: 'status-1',
            op: OpType.STATUS_CODE_CHECK,
            operator: {cmp: ComparisonType.EQUALS},
            value: 200,
          },
          {
            id: 'json-1',
            op: OpType.JSON_PATH,
            value: '$.data.status',
            operator: {cmp: ComparisonType.EQUALS},
            operand: {jsonpath_op: 'literal', value: ''},
          },
        ],
      },
    };

    render(
      <Form
        onSubmit={mockSubmit}
        model={model}
        initialData={{assertion: existingAssertion}}
      >
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Should render the status code assertion
    const statusCodeInput = await screen.findByDisplayValue('200');
    expect(statusCodeInput).toBeInTheDocument();

    // Should render the JSON path assertion
    const jsonPathInput = screen.getByDisplayValue('$.data.status');
    expect(jsonPathInput).toBeInTheDocument();

    // Verify the model has the initial data
    expect(model.initialData.assertion).toEqual(existingAssertion);
  });

  it('shows default assertions and submits them when no initialData is provided', async () => {
    render(
      <Form onSubmit={mockSubmit} model={model}>
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Wait for component to settle (react-popper causes async updates)
    await waitFor(() => {
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    // UI should show default 2xx assertions
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes[0]).toHaveValue('199');
    expect(textboxes[1]).toHaveValue('300');

    // getTransformedData (used by form submission) should return default assertions
    const transformedData = model.getTransformedData();
    expect(transformedData.assertion).toMatchObject({
      root: {
        id: expect.any(String),
        op: OpType.AND,
        children: [
          {
            id: expect.any(String),
            op: OpType.STATUS_CODE_CHECK,
            operator: {cmp: ComparisonType.GREATER_THAN},
            value: 199,
          },
          {
            id: expect.any(String),
            op: OpType.STATUS_CODE_CHECK,
            operator: {cmp: ComparisonType.LESS_THAN},
            value: 300,
          },
        ],
      },
    });
  });

  it('normalizes NaN values to 200 via getValue on form submission', async () => {
    // Set up assertion with NaN value (simulating cleared input submitted without blur)
    const assertionWithNaN: Assertion = {
      root: {
        id: 'root-1',
        op: OpType.AND,
        children: [
          {
            id: 'status-1',
            op: OpType.STATUS_CODE_CHECK,
            operator: {cmp: ComparisonType.EQUALS},
            value: NaN,
          },
        ],
      },
    };

    render(
      <Form
        onSubmit={mockSubmit}
        model={model}
        initialData={{assertion: assertionWithNaN}}
      >
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Wait for component to settle (react-popper causes async updates)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // Raw field value should still have NaN
    const rawValue = model.fields.get('assertion') as unknown as Assertion;
    expect(rawValue.root.children[0]).toMatchObject({
      op: OpType.STATUS_CODE_CHECK,
      value: NaN,
    });

    // getTransformedData (used by saveForm) should normalize via getValue
    const transformedData = model.getTransformedData();
    const transformedAssertion = transformedData.assertion as Assertion;
    expect(transformedAssertion.root.children[0]).toMatchObject({
      op: OpType.STATUS_CODE_CHECK,
      value: 200, // NaN normalized to 200
    });
  });

  it('clamps values below minimum to 100 via getValue on form submission', async () => {
    const assertionWithInvalidValues: Assertion = {
      root: {
        id: 'root-1',
        op: OpType.AND,
        children: [
          {
            id: 'status-1',
            op: OpType.STATUS_CODE_CHECK,
            operator: {cmp: ComparisonType.EQUALS},
            value: 50, // Below valid range (100-599)
          },
        ],
      },
    };

    render(
      <Form
        onSubmit={mockSubmit}
        model={model}
        initialData={{assertion: assertionWithInvalidValues}}
      >
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Wait for component to settle (react-popper causes async updates)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // getTransformedData should clamp to valid range
    const transformedData = model.getTransformedData();
    const transformedAssertion = transformedData.assertion as Assertion;
    expect(transformedAssertion.root.children[0]).toMatchObject({
      op: OpType.STATUS_CODE_CHECK,
      value: 100, // Clamped to minimum
    });
  });

  it('clamps values above maximum to 599 via getValue on form submission', async () => {
    const assertionWithInvalidValues: Assertion = {
      root: {
        id: 'root-1',
        op: OpType.AND,
        children: [
          {
            id: 'status-1',
            op: OpType.STATUS_CODE_CHECK,
            operator: {cmp: ComparisonType.EQUALS},
            value: 700, // Above valid range (100-599)
          },
        ],
      },
    };

    render(
      <Form
        onSubmit={mockSubmit}
        model={model}
        initialData={{assertion: assertionWithInvalidValues}}
      >
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const transformedData = model.getTransformedData();
    const transformedAssertion = transformedData.assertion as Assertion;
    expect(transformedAssertion.root.children[0]).toMatchObject({
      op: OpType.STATUS_CODE_CHECK,
      value: 599, // Clamped to maximum
    });
  });

  it('shows empty UI when editing monitor with no assertions', () => {
    // When editing a monitor that has no assertions, pass empty assertion structure
    // (FormField converts null to '' so we can't use null directly)
    const emptyAssertion: Assertion = {
      root: {
        id: 'empty',
        op: OpType.AND,
        children: [],
      },
    };

    render(
      <Form onSubmit={mockSubmit} model={model} initialData={{assertion: emptyAssertion}}>
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Should render the Add Assertion button
    expect(screen.getByRole('button', {name: 'Add Assertion'})).toBeInTheDocument();

    // Should NOT have any assertion inputs (no default 2xx assertions)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);

    // getValue should return null for empty assertions
    const transformedData = model.getTransformedData();
    expect(transformedData.assertion).toBeNull();
  });

  it('allows adding assertions when editing monitor with no assertions', async () => {
    // When editing a monitor that has no assertions, user should be able to add new ones
    const emptyAssertion: Assertion = {
      root: {
        id: 'empty',
        op: OpType.AND,
        children: [],
      },
    };

    render(
      <Form onSubmit={mockSubmit} model={model} initialData={{assertion: emptyAssertion}}>
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Should start with no assertion inputs
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);

    // Add a status code assertion
    await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Status Code'}));

    // Should now have 1 assertion input
    await waitFor(() => {
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
    });

    // getValue should return the new assertion (not null)
    const transformedData = model.getTransformedData();
    expect(transformedData.assertion).toMatchObject({
      root: {
        op: OpType.AND,
        children: [{op: OpType.STATUS_CODE_CHECK}],
      },
    });
  });

  it('returns null via getValue when all assertions are deleted', async () => {
    render(
      <Form onSubmit={mockSubmit} model={model}>
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Wait for default assertions to render (2 status code checks)
    await waitFor(() => {
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    // Delete both default assertions by clicking their remove buttons
    const removeButtons = screen.getAllByRole('button', {name: 'Remove assertion'});
    expect(removeButtons).toHaveLength(2);

    await userEvent.click(removeButtons[0]!);
    await waitFor(() => {
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
    });

    const remainingRemoveButton = screen.getByRole('button', {name: 'Remove assertion'});
    await userEvent.click(remainingRemoveButton);
    await waitFor(() => {
      expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    });

    // getValue should return null when all assertions are deleted
    const transformedData = model.getTransformedData();
    expect(transformedData.assertion).toBeNull();
  });
});

describe('normalizeAssertion', () => {
  it('handles NaN status code value by defaulting to 200', () => {
    const op: StatusCodeOp = {
      id: 'test-1',
      op: OpType.STATUS_CODE_CHECK,
      operator: {cmp: ComparisonType.EQUALS},
      value: NaN,
    };

    expect(normalizeAssertion(op)).toEqual({
      id: 'test-1',
      op: OpType.STATUS_CODE_CHECK,
      operator: {cmp: ComparisonType.EQUALS},
      value: 200,
    });
  });

  it('clamps status code values to valid HTTP range', () => {
    const tooLow: StatusCodeOp = {
      id: 'test-1',
      op: OpType.STATUS_CODE_CHECK,
      operator: {cmp: ComparisonType.EQUALS},
      value: 50,
    };

    const tooHigh: StatusCodeOp = {
      id: 'test-2',
      op: OpType.STATUS_CODE_CHECK,
      operator: {cmp: ComparisonType.EQUALS},
      value: 700,
    };

    expect((normalizeAssertion(tooLow) as StatusCodeOp).value).toBe(100);
    expect((normalizeAssertion(tooHigh) as StatusCodeOp).value).toBe(599);
  });

  it('preserves valid status code values', () => {
    const valid: StatusCodeOp = {
      id: 'test-1',
      op: OpType.STATUS_CODE_CHECK,
      operator: {cmp: ComparisonType.EQUALS},
      value: 404,
    };

    expect((normalizeAssertion(valid) as StatusCodeOp).value).toBe(404);
  });

  it('recursively normalizes nested assertions in and/or groups', () => {
    const nested: AndOp = {
      id: 'group-1',
      op: OpType.AND,
      children: [
        {
          id: 'test-1',
          op: OpType.STATUS_CODE_CHECK,
          operator: {cmp: ComparisonType.EQUALS},
          value: NaN,
        },
        {
          id: 'test-2',
          op: OpType.STATUS_CODE_CHECK,
          operator: {cmp: ComparisonType.EQUALS},
          value: 800,
        },
      ],
    };

    const result = normalizeAssertion(nested) as AndOp;
    expect((result.children[0] as StatusCodeOp).value).toBe(200);
    expect((result.children[1] as StatusCodeOp).value).toBe(599);
  });
});
