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
  let organization;
  let mockNavigate;

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
    await userEvent.click(screen.queryAllByRole('button', {name: 'Remove field'})[0]);

    expect(screen.queryAllByRole('button', {name: 'Remove field'})[0]).toBeDisabled();
  });

  it('disables the column selection when the aggregate has no parameters', async () => {
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

    expect(screen.getByRole('button', {name: 'Column Selection'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toBeEnabled();

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveValue('');
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

    expect(screen.getByRole('button', {name: 'Column Selection'})).toBeDisabled();

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
      'None'
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
    await userEvent.click(screen.getByRole('option', {name: 'None'}));

    await userEvent.click(screen.getByRole('button', {name: 'Column Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'transaction.duration'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'transaction.duration'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'None'
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

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'None'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'count'
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['count()'],
        }),
      })
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
      'transaction.duration'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'count_miserable'
    );
    expect(screen.getByDisplayValue('300')).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['count_miserable(transaction.duration,300)'],
        }),
      })
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

    // TODO: This is supposed to only allow the user field
    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'transaction.duration'
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

  it('disables the aggregate selection when there is only one aggregate option', async () => {
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
  });
});
