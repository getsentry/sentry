import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
    expect(await screen.findByRole('spinbutton')).toBeInTheDocument();

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
    const statusCodeInput = await screen.findByRole('spinbutton');
    expect(statusCodeInput).toHaveValue(200);

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
});
