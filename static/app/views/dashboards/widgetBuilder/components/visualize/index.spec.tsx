import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import Visualize from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/utils/useCustomMeasurements');
jest.mock('sentry/views/explore/contexts/spanTagsContext');
jest.mock('sentry/utils/useNavigate');

describe('Visualize', () => {
  let organization!: ReturnType<typeof OrganizationFixture>;
  let mockNavigate!: jest.Mock;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['dashboards-widget-builder-redesign', 'performance-view'],
    });

    jest.mocked(useCustomMeasurements).mockReturnValue({
      customMeasurements: {},
    });

    jest.mocked(useSpanTags).mockReturnValue({});

    mockNavigate = jest.fn();
    jest.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it('renders basic aggregates correctly from the URL params', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['p90(transaction.duration)', 'max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(await screen.findByText('+ Add Series')).toBeInTheDocument();
    const p90FieldRow = (await screen.findByText('p90')).closest(
      '[data-testid="field-bar"]'
    ) as HTMLElement;
    expect(p90FieldRow).toBeInTheDocument();
    expect(within(p90FieldRow).getByText('transaction.duration')).toBeInTheDocument();

    const maxFieldRow = (await screen.findByText('max')).closest(
      '[data-testid="field-bar"]'
    ) as HTMLElement;
    expect(maxFieldRow).toBeInTheDocument();
    expect(within(maxFieldRow).getByText('spans.db')).toBeInTheDocument();
  });

  it('allows adding and deleting series', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(await screen.findByRole('button', {name: 'Remove field'})).toBeDisabled();

    await userEvent.click(screen.getByRole('button', {name: 'Add Series'}));

    expect(screen.queryAllByRole('button', {name: 'Remove field'})[0]).toBeEnabled();
    await userEvent.click(screen.queryAllByRole('button', {name: 'Remove field'})[0]!);

    expect(screen.queryAllByRole('button', {name: 'Remove field'})[0]).toBeDisabled();
  });

  it('removes the column selection when the aggregate has no parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(screen.getByRole('button', {name: 'Column Selection'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'count'}));

    expect(
      screen.queryByRole('button', {name: 'Column Selection'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toBeEnabled();
  });

  it('adds the default value for the column selection when the aggregate has parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'p95'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'transaction.duration'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'p95'
    );
  });

  it('maintains the selected aggregate when the column selection is changed and there are parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'p95'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'spans.db'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'p95'
    );
  });

  it('allows adding equations', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add Equation'}));

    expect(screen.getByLabelText('Equation')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Equation'));

    // Check the menu items
    const headers = screen.getAllByRole('banner');
    expect(headers[0]).toHaveTextContent('Fields');
    expect(headers[1]).toHaveTextContent('Operators');
    expect(screen.getByRole('listitem', {name: 'count()'})).toBeInTheDocument();

    // Make a selection and type in the equation
    await userEvent.click(screen.getByRole('listitem', {name: 'count()'}));
    await userEvent.type(screen.getByLabelText('Equation'), '* 2');

    expect(screen.getByLabelText('Equation')).toHaveValue('count() * 2');
  });

  it('renders a field without an aggregate in tables', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['transaction.duration'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    expect(
      await screen.findByRole('button', {name: 'Column Selection'})
    ).toHaveTextContent('transaction.duration');
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'field (no aggregate)'
    );
  });

  it('allows setting a field without an aggregate in tables', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'field (no aggregate)'}));

    await userEvent.click(screen.getByRole('button', {name: 'Column Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'transaction.duration'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'transaction.duration'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'field (no aggregate)'
    );
  });

  it('allows setting an equation in tables', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add Equation'}));
    await userEvent.click(screen.getByLabelText('Equation'));
    await userEvent.click(screen.getByRole('listitem', {name: 'count()'}));
    await userEvent.type(screen.getByLabelText('Equation'), '* 2');

    expect(screen.getByLabelText('Equation')).toHaveValue('count() * 2');
  });

  it('maintains the selected column when switching from field to aggregate', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['transaction.duration'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'p95'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'transaction.duration'
    );
  });

  it('maintains the selected column when switching from aggregate to aggregate', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'p95'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'spans.db'
    );
  });

  it('properly transitions between aggregates of higher to no parameter count', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['count_if(transaction.duration,equals,testValue)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'count'}));

    expect(
      screen.queryByRole('button', {name: 'Column Selection'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'count'
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['count()'],
        }),
      }),
      {replace: true}
    );
  });

  it('properly transitions between aggregates of higher to lower parameter count', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['count_if(transaction.duration,equals,testValue)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'count_miserable'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'user'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'count_miserable'
    );
    expect(screen.getByDisplayValue('300')).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['count_miserable(user,300)'],
        }),
      }),
      {replace: true}
    );
  });

  it('adds the default value for an aggregate with 2 parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['transaction.duration'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'count_miserable'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'user'
    );
  });

  it('adds the default values for an aggregate with 3 parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['transaction'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'count_if'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'transaction'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'count_if'
    );
    expect(screen.getByText('is equal to')).toBeInTheDocument();
    expect(screen.getByDisplayValue('300')).toBeInTheDocument();
  });

  it('disables the aggregate selection for issue widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.ISSUE,
              field: ['issue.id'],
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    expect(
      await screen.findByRole('button', {name: 'Aggregate Selection'})
    ).toBeDisabled();
  });

  it('does not show the legend alias input for chart widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
              yAxis: ['p90(transaction.duration)'],
            },
          }),
        }),
      }
    );

    expect(
      await screen.findByRole('button', {name: 'Column Selection'})
    ).toHaveTextContent('transaction.duration');
    expect(
      await screen.findByRole('button', {name: 'Aggregate Selection'})
    ).toHaveTextContent('p90');
    expect(screen.queryByLabelText('Legend Alias')).not.toBeInTheDocument();
  });

  it('does not show the legend alias input for big number widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.BIG_NUMBER,
              field: ['count()'],
            },
          }),
        }),
      }
    );

    expect(
      await screen.findByRole('button', {name: 'Aggregate Selection'})
    ).toHaveTextContent('count');
    expect(screen.queryByLabelText('Legend Alias')).not.toBeInTheDocument();
  });

  it('does not allow for selecting individual fields in big number widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.BIG_NUMBER,
              field: ['count()'],
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));

    // Being unable to choose "field (no aggregate)" in the aggregate selection means that the
    // individual field is not allowed, i.e. only aggregates appear.
    expect(
      screen.queryByRole('option', {name: 'field (no aggregate)'})
    ).not.toBeInTheDocument();
  });

  it('updates only the selected field', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
              field: ['p50(transaction.duration)'],
            },
          }),
        }),
      }
    );

    expect(await screen.findByLabelText('Aggregate Selection')).toHaveTextContent('p50');
    expect(screen.getByLabelText('Column Selection')).toHaveTextContent(
      'transaction.duration'
    );

    // Add 3 fields
    await userEvent.click(screen.getByRole('button', {name: 'Add Column'}));
    await userEvent.click(screen.getByRole('button', {name: 'Add Column'}));
    await userEvent.click(screen.getByRole('button', {name: 'Add Column'}));

    // count() is the default aggregate when adding a field
    expect(screen.getAllByText('count_unique')).toHaveLength(3);

    // Change the last field
    await userEvent.click(screen.getAllByText('count_unique')[2]!);
    await userEvent.click(screen.getByRole('option', {name: 'epm'}));

    // The other fields should not be affected
    expect(screen.getByText('p50')).toBeInTheDocument();
    expect(screen.getAllByText('count_unique')).toHaveLength(2);
    expect(screen.getAllByText('epm')).toHaveLength(1);
  });

  it('shows appropriate error messages for non-chart widget queries', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize
          error={{
            queries: [
              {
                fields: ['this field has an error'],
                aggregates: ['this aggregate has an error'],
              },
            ],
          }}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.BIG_NUMBER,
            },
          }),
        }),
      }
    );

    expect(await screen.findByText('this field has an error')).toBeInTheDocument();
    expect(screen.queryByText('this aggregate has an error')).not.toBeInTheDocument();
  });

  it('shows appropriate error messages for chart type widget queries', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize
          error={{
            queries: [
              {
                fields: ['this field has an error'],
                aggregates: ['this aggregate has an error'],
              },
            ],
          }}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(await screen.findByText('this aggregate has an error')).toBeInTheDocument();
    expect(screen.queryByText('this field has an error')).not.toBeInTheDocument();
  });

  it('shows radio buttons for big number widgets when there are multiple aggregates', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.BIG_NUMBER,
              field: ['count_unique(user)'],
            },
          }),
        }),
      }
    );

    expect(await screen.findByLabelText('Aggregate Selection')).toHaveTextContent(
      'count_unique'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add Field'}));

    // There are two radio buttons, one for each aggregate, and the last one is selected
    expect(screen.getAllByLabelText('aggregate-selector')).toHaveLength(2);
    expect(screen.getByRole('radio', {name: 'field1'})).toBeChecked();
  });

  it('shifts the selected aggregate up when it is the last one and removed', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.BIG_NUMBER,
              field: ['count_unique(1)', 'count_unique(2)', 'count_unique(3)'],
              selectedAggregate: '2',
            },
          }),
        }),
      }
    );

    expect(await screen.findByRole('radio', {name: 'field2'})).toBeChecked();
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove field'})[2]!);

    // The second field is now selected, but the URL param for selectedAggregate
    // is cleared, so the last field is selected
    expect(await screen.findByRole('radio', {name: 'field1'})).toBeChecked();
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          selectedAggregate: undefined,
        }),
      }),
      {replace: true}
    );
  });

  it('only shows the relevant options for the release dataset', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.RELEASE,
              field: ['crash_free_rate(session)'],
            },
          }),
        }),
      }
    );

    expect(
      await screen.findByRole('button', {name: 'Column Selection'})
    ).toHaveTextContent('session');
    await userEvent.click(screen.getByRole('button', {name: 'Column Selection'}));
    const listbox = await screen.findAllByRole('option');
    expect(listbox).toHaveLength(2);
    expect(listbox[0]).toHaveTextContent('session');
    expect(listbox[1]).toHaveTextContent('user');
  });

  it('clears out the field when the selected aggregate has no parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              field: ['transaction.duration'],
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'count'}));

    expect(
      screen.queryByRole('button', {name: 'Column Selection'})
    ).not.toBeInTheDocument();
  });

  it('uses the provided value for a value parameter field', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              field: ['count_if(transaction.duration,equals,300)'],
            },
          }),
        }),
      }
    );

    // Simulate clearing and typing a new value from the user
    await userEvent.type(
      screen.getByDisplayValue('300'),
      '{backspace}{backspace}{backspace}400'
    );

    // Unfocus the field
    await userEvent.tab();

    expect(await screen.findByDisplayValue('400')).toBeInTheDocument();
  });

  it('restricts deleting the last aggregate in release health widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.RELEASE,
              field: ['crash_free_rate(session)', 'environment'],
            },
          }),
        }),
      }
    );

    const removeButtons = await screen.findAllByRole('button', {name: 'Remove field'});
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).toBeEnabled();
  });

  it('shows a text box and removes the column selection for apdex', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              field: ['apdex(3000)'],
            },
          }),
        }),
      }
    );

    expect(
      await screen.findByRole('button', {name: 'Aggregate Selection'})
    ).toHaveTextContent('apdex');
    expect(screen.getByRole('textbox', {name: 'Numeric Input'})).toHaveValue('3000');
    expect(
      screen.queryByRole('button', {name: 'Column Selection'})
    ).not.toBeInTheDocument();
  });

  it('resets the text box value when swapping between apdex and user_misery', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              field: ['apdex(9999)'],
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'user_misery'}));

    expect(screen.getByRole('textbox', {name: 'Numeric Input'})).toHaveValue('300');
  });

  it('does not allow for deleting the only field or aggregate when there is an equation', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              field: ['equation|count()+1', 'count()'],
            },
          }),
        }),
      }
    );

    const removeButtons = await screen.findAllByRole('button', {name: 'Remove field'});
    expect(removeButtons[0]).toBeEnabled();
    expect(removeButtons[1]).toBeDisabled();
  });

  it('shows draggable button when there is more than one field on non big number widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              field: ['transaction.duration', 'transaction.id'],
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    expect(await screen.findAllByRole('button', {name: 'Drag to reorder'})).toHaveLength(
      2
    );
  });

  it('allows for selecting a column from the aggregate dropdown', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              field: ['count()'],
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'message'}));

    // Component automatically populates the selection as a column
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'field (no aggregate)'
    );
    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'message'
    );
  });

  it('shows the correct aggregate options for release dataset', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {dataset: WidgetType.RELEASE, field: ['crash_free_rate(session)']},
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    expect(screen.getByRole('option', {name: 'release'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'environment'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'project'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'session.status'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'user'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'session'})).not.toBeInTheDocument();
  });

  it('adds a separate field when only one function field is present on release tables', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {dataset: WidgetType.RELEASE, field: ['crash_free_rate(session)']},
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'release'}));

    expect(screen.getAllByRole('button', {name: 'Column Selection'})).toHaveLength(2);
    expect(
      screen.getAllByRole('button', {name: 'Column Selection'})[0]
    ).toHaveTextContent('release');
    expect(
      screen.getAllByRole('button', {name: 'Column Selection'})[1]
    ).toHaveTextContent('session');

    expect(
      screen.getAllByRole('button', {name: 'Aggregate Selection'})[1]
    ).toHaveTextContent('crash_free_rate');
  });

  describe('spans', () => {
    beforeEach(() => {
      jest.mocked(useSpanTags).mockImplementation((type?: 'string' | 'number') => {
        if (type === 'number') {
          return {
            'span.duration': {
              key: 'span.duration',
              name: 'span.duration',
              kind: 'measurement',
            },
            'tags[anotherNumericTag,number]': {
              key: 'anotherNumericTag',
              name: 'anotherNumericTag',
              kind: 'measurement',
            },
          } as TagCollection;
        }

        return {
          'span.description': {
            key: 'span.description',
            name: 'span.description',
            kind: 'tag',
          },
        } as TagCollection;
      });
    });

    it('shows numeric tags as primary options for chart widgets', async () => {
      render(
        <WidgetBuilderProvider>
          <Visualize />
        </WidgetBuilderProvider>,
        {
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {
                dataset: WidgetType.SPANS,
                displayType: DisplayType.LINE,
                yAxis: ['p90(span.duration)'],
              },
            }),
          }),
        }
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Column Selection'})
      );

      const listbox = await screen.findByRole('listbox', {name: 'Column Selection'});
      expect(within(listbox).getByText('anotherNumericTag')).toBeInTheDocument();
      expect(within(listbox).queryByText('span.description')).not.toBeInTheDocument();
    });

    it('shows the correct aggregate options', async () => {
      render(
        <WidgetBuilderProvider>
          <Visualize />
        </WidgetBuilderProvider>,
        {
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {
                dataset: WidgetType.SPANS,
                displayType: DisplayType.LINE,
                yAxis: ['count(span.duration)'],
              },
            }),
          }),
        }
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Aggregate Selection'})
      );

      // count has two entries because it's already selected
      // and in the dropdown
      expect(screen.getAllByText('count')).toHaveLength(2);
      expect(screen.getByText('avg')).toBeInTheDocument();
      expect(screen.getByText('max')).toBeInTheDocument();
      expect(screen.getByText('min')).toBeInTheDocument();
      expect(screen.getByText('p50')).toBeInTheDocument();
      expect(screen.getByText('p75')).toBeInTheDocument();
      expect(screen.getByText('p90')).toBeInTheDocument();
      expect(screen.getByText('p95')).toBeInTheDocument();
      expect(screen.getByText('p99')).toBeInTheDocument();
      expect(screen.getByText('p100')).toBeInTheDocument();
      expect(screen.getByText('sum')).toBeInTheDocument();
    });

    it('shows the correct column options for the aggregate field type', async () => {
      render(
        <WidgetBuilderProvider>
          <Visualize />
        </WidgetBuilderProvider>,
        {
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {
                dataset: WidgetType.SPANS,
                displayType: DisplayType.TABLE,
                field: ['p90(span.duration)'],
              },
            }),
          }),
        }
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Column Selection'})
      );

      const listbox = await screen.findByRole('listbox', {name: 'Column Selection'});
      expect(within(listbox).getByText('span.duration')).toBeInTheDocument();
      expect(within(listbox).getByText('anotherNumericTag')).toBeInTheDocument();
    });

    it('shows the correct column options for the non-aggregate field type', async () => {
      render(
        <WidgetBuilderProvider>
          <Visualize />
        </WidgetBuilderProvider>,
        {
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {
                dataset: WidgetType.SPANS,
                displayType: DisplayType.TABLE,
                field: ['span.duration'],
              },
            }),
          }),
        }
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Column Selection'})
      );

      const listbox = await screen.findByRole('listbox', {name: 'Column Selection'});
      expect(within(listbox).getByText('span.duration')).toBeInTheDocument();
      expect(within(listbox).getByText('span.description')).toBeInTheDocument();
    });

    it('differentiates between function and column values in selection', async () => {
      jest.mocked(useSpanTags).mockImplementation((type?: 'string' | 'number') => {
        if (type === 'number') {
          return {
            'tags[count,number]': {
              key: 'count',
              name: 'count',
              kind: 'measurement',
            },
          } as TagCollection;
        }

        return {
          count: {
            key: 'count',
            name: 'count',
            kind: 'tag',
          },
        } as TagCollection;
      });
      render(
        <WidgetBuilderProvider>
          <Visualize />
        </WidgetBuilderProvider>,
        {
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {
                dataset: WidgetType.SPANS,
                displayType: DisplayType.TABLE,
                field: ['count(span.duration)'],
              },
            }),
          }),
        }
      );

      // Only one count option should be shown as selected
      expect(
        await screen.findByRole('button', {name: 'Aggregate Selection'})
      ).toHaveTextContent(/^count$/);
    });
  });
});
