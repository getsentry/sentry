import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useCustomMeasurements} from 'sentry/utils/useCustomMeasurements';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderSlideout} from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {
  useSpanItemAttributes,
  useTraceItemDatasetAttributes,
  useTraceMetricItemAttributes,
} from 'sentry/views/explore/hooks/useTraceItemAttributes';

jest.mock('sentry/utils/useCustomMeasurements');
jest.mock('sentry/views/explore/hooks/useTraceItemAttributes');
jest.mock('sentry/actionCreators/indicator');

describe('WidgetBuilderSlideout', () => {
  let organization!: ReturnType<typeof OrganizationFixture>;
  beforeEach(() => {
    organization = OrganizationFixture();

    jest.mocked(useCustomMeasurements).mockReturnValue({customMeasurements: {}});

    jest
      .mocked(useTraceItemDatasetAttributes)
      .mockReturnValue({attributes: {}, secondaryAliases: {}, isLoading: false});
    jest
      .mocked(useSpanItemAttributes)
      .mockReturnValue({attributes: {}, secondaryAliases: {}, isLoading: false});
    jest
      .mocked(useTraceMetricItemAttributes)
      .mockReturnValue({attributes: {}, secondaryAliases: {}, isLoading: false});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 200,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [], meta: {fields: {}, units: {}}},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show the sort by step if the widget is a chart and there are fields selected', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              field: ['project'],
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    expect(await screen.findByText('Sort by')).toBeInTheDocument();
    expect(await screen.findByText('Limit to 5 results')).toBeInTheDocument();
    expect(await screen.findByText('High to low')).toBeInTheDocument();
    expect(await screen.findByText('(Required)')).toBeInTheDocument();
  });

  it('should show the sort by step if the widget is a table', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              field: [],
              yAxis: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          },
        },
      }
    );

    expect(await screen.findByText('Sort by')).toBeInTheDocument();
  });

  it('should not show the sort by step if the widget is a chart without fields', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              field: [],
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    expect(await screen.findByText('count')).toBeInTheDocument();
    expect(screen.queryByText('Sort by')).not.toBeInTheDocument();
  });

  it('should show the confirm modal if the widget is unsaved', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );
    renderGlobalModal();

    await userEvent.type(await screen.findByPlaceholderText('Name'), 'some name');
    await userEvent.click(await screen.findByText('Close'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('You have unsaved changes. Are you sure you want to leave?')
    ).toBeInTheDocument();
  });

  it('should not show the confirm modal if the widget is unsaved', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    renderGlobalModal();

    await userEvent.click(await screen.findByText('Close'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText('You have unsaved changes. Are you sure you want to leave?')
    ).not.toBeInTheDocument();
  });

  it('should not save and close the widget builder if the widget is invalid', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      body: {title: 'Title is required during creation'},
      statusCode: 400,
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              field: [],
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    await userEvent.click(await screen.findByText('Add Widget'));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('Title is required during creation');
    });

    expect(screen.getByText('Custom Widget Builder')).toBeInTheDocument();
  });

  it('clears the alias when dataset changes', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization: OrganizationFixture({features: ['visibility-explore-view']}),
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              field: ['count(span.duration)'],
              yAxis: [],
              dataset: WidgetType.SPANS,
              displayType: DisplayType.TABLE,
            },
          },
        },
      }
    );

    await userEvent.type(await screen.findByPlaceholderText('Add Alias'), 'test alias');
    expect(screen.getByPlaceholderText('Add Alias')).toHaveValue('test alias');

    await userEvent.click(await screen.findByRole('button', {name: 'Spans'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Errors'}));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add Alias')).toHaveValue('');
    });
  }, 10_000);

  it('clears the alias when display type changes', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              field: ['count()'],
              yAxis: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          },
        },
      }
    );

    await userEvent.type(
      await screen.findByPlaceholderText('Add Alias'),
      'test alias again'
    );
    expect(screen.getByPlaceholderText('Add Alias')).toHaveValue('test alias again');

    await userEvent.click(await screen.findByRole('button', {name: 'Table'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Area'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Area'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Table'}));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add Alias')).toHaveValue('');
    });
  }, 10_000);

  it('only renders thresholds for big number widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.BIG_NUMBER,
            },
          },
        },
      }
    );

    expect(await screen.findByText('Thresholds')).toBeInTheDocument();
  });

  it('calls the save method with the index if it is defined', async () => {
    const onSave = jest.fn();
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={onSave}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          route: '/dashboards/:widgetIndex/',
          location: {pathname: '/dashboards/1/'},
        },
      }
    );

    await userEvent.click(await screen.findByText('Update Widget'));

    expect(onSave).toHaveBeenCalledWith({index: 1, widget: expect.any(Object)});
  });

  it('saves the selected threshold interval', async () => {
    const onSave = jest.fn();
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={onSave}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          route: '/dashboards/:widgetIndex/',
          location: {
            pathname: '/dashboards/1/',
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
              yAxis: ['count()'],
              thresholds: '{"max_values":{"max1":100,"max2":200},"unit":null}',
            },
          },
        },
      }
    );

    await userEvent.click(await screen.findByRole('textbox', {name: 'Interval'}));
    await userEvent.click(screen.getByText('1 hour'));
    await userEvent.click(screen.getByRole('button', {name: 'Update Widget'}));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        index: 1,
        widget: expect.objectContaining({
          thresholds: expect.objectContaining({
            timeWindow: '1h',
          }),
        }),
      });
    });
  });

  it('omits the threshold time window when Fixed is selected', async () => {
    const onSave = jest.fn();
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={onSave}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          route: '/dashboards/:widgetIndex/',
          location: {
            pathname: '/dashboards/1/',
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
              yAxis: ['count()'],
              thresholds:
                '{"max_values":{"max1":100,"max2":200},"unit":null,"timeWindow":"10m"}',
            },
          },
        },
      }
    );

    await userEvent.click(await screen.findByRole('textbox', {name: 'Interval'}));
    await userEvent.click(screen.getByText('Fixed'));
    await userEvent.click(screen.getByRole('button', {name: 'Update Widget'}));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]?.[0].widget.thresholds).not.toHaveProperty('timeWindow');
  });

  it('passes undefined as the index for onSave if the index is not defined', async () => {
    const onSave = jest.fn();

    // This is the case where we're adding a new widget
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={onSave}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    await userEvent.click(await screen.findByText('Add Widget'));

    expect(onSave).toHaveBeenCalledWith({
      index: undefined,
      widget: expect.any(Object),
    });
  });

  it('should render the widget template title if templates selected', () => {
    const onSave = jest.fn();
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={onSave}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    expect(screen.getByText('Widget Library')).toBeInTheDocument();
  });

  it('should render a back button to the library if a library widget is customized', async () => {
    const onSave = jest.fn();
    const {rerender} = render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={onSave}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    screen.getByText('Widget Library');

    await userEvent.click(screen.getByText('Duration Distribution'));
    await userEvent.click(screen.getByText('Customize'));

    rerender(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={onSave}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>
    );

    expect(
      await screen.findByRole('button', {name: 'Back to Widget Library'})
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {name: 'Custom Widget Builder'})
    ).toBeInTheDocument();
  });

  it('should return to the widget library when the back button is clicked', async () => {
    const setOpenWidgetTemplates = jest.fn();
    const {rerender} = render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates
          setOpenWidgetTemplates={setOpenWidgetTemplates}
        />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    await userEvent.click(screen.getByText('Duration Distribution'));
    await userEvent.click(screen.getByText('Customize'));

    rerender(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={setOpenWidgetTemplates}
        />
      </WidgetBuilderProvider>
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Back to Widget Library'})
    );

    expect(setOpenWidgetTemplates).toHaveBeenCalledWith(true);
    // customizeFromLibrary resets, so the back button unmounts
    expect(
      screen.queryByRole('button', {name: 'Back to Widget Library'})
    ).not.toBeInTheDocument();
  });

  it('should show deprecation alert when flag enabled', async () => {
    const organizationWithFeature = OrganizationFixture({
      features: [
        'discover-saved-queries-deprecation',
        'performance-transaction-deprecation-banner',
      ],
    });
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization: organizationWithFeature,
        initialRouterConfig: {
          route: '/dashboards/:widgetIndex/',
          location: {
            pathname: '/dashboards/1/',
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );
    renderGlobalModal();

    expect(
      await screen.findByText(
        /Editing of transaction-based widgets is disabled, as we migrate to the span dataset/i
      )
    ).toBeInTheDocument();

    expect(screen.getAllByTestId('transaction-widget-disabled-wrapper')).toHaveLength(2);
  });

  it('should not show deprecation alert when flag enabled', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          route: '/dashboards/:widgetIndex/',
          location: {
            pathname: '/dashboards/1/',
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );
    renderGlobalModal();

    await waitFor(() => {
      expect(
        screen.queryByText(
          /You may have limited functionality due to the ongoing migration of transactions to spans/i
        )
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('transaction-widget-disabled-wrapper')
    ).not.toBeInTheDocument();
  });

  it('should not show the query filter builder if the widget is an issue and a chart display type', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              dataset: WidgetType.ISSUE,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    expect(screen.queryByLabelText('Add a search term')).not.toBeInTheDocument();

    // Wait for any pending popper updates to complete
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Issues'})).toBeInTheDocument();
    });
  });

  it('should show the markdown content field for text widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              displayType: DisplayType.TEXT,
            },
          },
        },
      }
    );

    expect(
      await screen.findByPlaceholderText('Write your markdown here...')
    ).toBeInTheDocument();
  });

  it('should not show the dataset selector for text widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              displayType: DisplayType.TEXT,
            },
          },
        },
      }
    );

    expect(
      await screen.findByPlaceholderText('Write your markdown here...')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Errors'})).not.toBeInTheDocument();
  });

  it('should not show the sort by step for text widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              displayType: DisplayType.TEXT,
            },
          },
        },
      }
    );

    expect(
      await screen.findByPlaceholderText('Write your markdown here...')
    ).toBeInTheDocument();
    expect(screen.queryByText('Sort by')).not.toBeInTheDocument();
  });

  it('stays in series mode after a dataset round-trip', async () => {
    render(
      <WidgetBuilderSlideout
        dashboard={DashboardFixture([])}
        dashboardFilters={{release: undefined}}
        onClose={jest.fn()}
        onQueryConditionChange={jest.fn()}
        onSave={jest.fn()}
        setIsPreviewDraggable={jest.fn()}
        openWidgetTemplates={false}
        setOpenWidgetTemplates={jest.fn()}
      />,
      {
        organization: OrganizationFixture({
          features: ['tracemetrics-enabled'],
        }),
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
              yAxis: ['sum(value,alpha_metric,counter,none)'],
            },
          },
        },
        additionalWrapper: WidgetBuilderProvider,
      }
    );

    expect(await screen.findByRole('radio', {name: 'Series'})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Application Metrics'}));
    await userEvent.click(screen.getByRole('option', {name: 'Errors'}));

    expect(screen.queryByRole('radio', {name: 'Series'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Errors'}));
    await userEvent.click(screen.getByRole('option', {name: 'Application Metrics'}));

    await waitFor(() => {
      expect(screen.getByRole('radio', {name: 'Series'})).toBeChecked();
    });
  });

  it('restores equation mode after a dataset round-trip', async () => {
    render(
      <WidgetBuilderSlideout
        dashboard={DashboardFixture([])}
        dashboardFilters={{release: undefined}}
        onClose={jest.fn()}
        onQueryConditionChange={jest.fn()}
        onSave={jest.fn()}
        setIsPreviewDraggable={jest.fn()}
        openWidgetTemplates={false}
        setOpenWidgetTemplates={jest.fn()}
      />,
      {
        organization: OrganizationFixture({
          features: ['tracemetrics-enabled'],
        }),
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
              yAxis: [
                'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
              ],
            },
          },
        },
        additionalWrapper: WidgetBuilderProvider,
      }
    );

    expect(await screen.findByRole('radio', {name: 'Equation'})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Application Metrics'}));
    await userEvent.click(screen.getByRole('option', {name: 'Errors'}));

    expect(screen.queryByRole('radio', {name: 'Equation'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Errors'}));
    await userEvent.click(screen.getByRole('option', {name: 'Application Metrics'}));

    await waitFor(() => {
      expect(screen.getByRole('radio', {name: 'Equation'})).toBeChecked();
    });
  });

  it('shows the optional group by selector for Trace Metrics equations', async () => {
    render(
      <WidgetBuilderSlideout
        dashboard={DashboardFixture([])}
        dashboardFilters={{release: undefined}}
        onClose={jest.fn()}
        onQueryConditionChange={jest.fn()}
        onSave={jest.fn()}
        setIsPreviewDraggable={jest.fn()}
        openWidgetTemplates={false}
        setOpenWidgetTemplates={jest.fn()}
      />,
      {
        organization: OrganizationFixture({
          features: ['tracemetrics-enabled'],
        }),
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.TABLE,
              field: [
                'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
              ],
            },
          },
        },
        additionalWrapper: WidgetBuilderProvider,
      }
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Group'})).toBeInTheDocument();
  });

  it('should not show the group by selector if the widget is an issue and a chart display type', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/dashboards/',
            query: {
              dataset: WidgetType.ISSUE,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    expect(screen.queryByText('Group by')).not.toBeInTheDocument();

    // Wait for any pending popper updates to complete
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Issues'})).toBeInTheDocument();
    });
  });
});
