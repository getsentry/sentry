import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';

import {UptimeAssertionsField} from './field';

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

    // Click to add an assertion
    await userEvent.click(screen.getByRole('button', {name: 'Add Assertion'}));

    // Should show the assertion type menu
    expect(await screen.findByRole('menu')).toBeInTheDocument();

    // Add a status code assertion
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Status Code'}));

    // Should render the status code input
    expect(await screen.findByRole('textbox')).toBeInTheDocument();

    // Verify the model has been updated with the assertion structure
    const fieldValue = model.fields.get('assertion') as unknown as Assertion;
    expect(fieldValue).toMatchObject({
      root: {
        op: 'and',
        children: [{op: 'status_code_check'}],
      },
    });
  });

  it('renders existing assertion from initialData', async () => {
    const existingAssertion: Assertion = {
      root: {
        id: 'root-1',
        op: 'and',
        children: [
          {
            id: 'status-1',
            op: 'status_code_check',
            operator: {cmp: 'equals'},
            value: 200,
          },
          {
            id: 'json-1',
            op: 'json_path',
            value: '$.data.status',
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

  it('uses defaultValue when no initialData is provided', () => {
    render(
      <Form onSubmit={mockSubmit} model={model}>
        <UptimeAssertionsField name="assertion" />
      </Form>
    );

    // Should have default empty assertion structure
    const fieldValue = model.fields.get('assertion') as unknown as Assertion;
    expect(fieldValue).toEqual({
      root: {id: expect.any(String), op: 'and', children: []},
    });
  });

  it('normalizes NaN values to 200 via getValue on form submission', async () => {
    // Set up assertion with NaN value (simulating cleared input submitted without blur)
    const assertionWithNaN: Assertion = {
      root: {
        id: 'root-1',
        op: 'and',
        children: [
          {
            id: 'status-1',
            op: 'status_code_check',
            operator: {cmp: 'equals'},
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
      op: 'status_code_check',
      value: NaN,
    });

    // getTransformedData (used by saveForm) should normalize via getValue
    const transformedData = model.getTransformedData();
    const transformedAssertion = transformedData.assertion as Assertion;
    expect(transformedAssertion.root.children[0]).toMatchObject({
      op: 'status_code_check',
      value: 200, // NaN normalized to 200
    });
  });

  it('clamps out-of-range values via getValue on form submission', async () => {
    const assertionWithInvalidValues: Assertion = {
      root: {
        id: 'root-1',
        op: 'and',
        children: [
          {
            id: 'status-1',
            op: 'status_code_check',
            operator: {cmp: 'equals'},
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
      op: 'status_code_check',
      value: 100, // Clamped to minimum
    });
  });
});
