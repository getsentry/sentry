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
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {useParams} from 'sentry/utils/useParams';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import WidgetBuilderSlideout from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/utils/useCustomMeasurements');
jest.mock('sentry/views/explore/contexts/spanTagsContext');
jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/utils/useParams');

describe('WidgetBuilderSlideout', () => {
  let organization!: ReturnType<typeof OrganizationFixture>;
  beforeEach(() => {
    organization = OrganizationFixture();

    jest.mocked(useCustomMeasurements).mockReturnValue({customMeasurements: {}});

    jest
      .mocked(useTraceItemTags)
      .mockReturnValue({tags: {}, secondaryAliases: {}, isLoading: false});

    jest.mocked(useParams).mockReturnValue({widgetIndex: undefined});

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
          isWidgetInvalid={false}
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
          isWidgetInvalid={false}
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
          isWidgetInvalid={false}
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
          isWidgetInvalid={false}
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
          isWidgetInvalid={false}
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
          isWidgetInvalid
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
          isWidgetInvalid
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

    await userEvent.type(await screen.findByPlaceholderText('Add Alias'), 'test alias');
    await userEvent.click(screen.getByText('Errors'));

    expect(await screen.findByPlaceholderText('Add Alias')).toHaveValue('');
  }, 10_000);

  it('clears the alias when display type changes', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid
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

    await userEvent.click(await screen.findByText('Table'));
    await userEvent.click(await screen.findByText('Area'));
    await userEvent.click(await screen.findByText('Area'));
    await userEvent.click(await screen.findByText('Table'));

    expect(await screen.findByPlaceholderText('Add Alias')).toHaveValue('');
  }, 10_000);

  it('only renders thresholds for big number widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid
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
    jest.mocked(useParams).mockReturnValue({widgetIndex: '1'});

    const onSave = jest.fn();
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid
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

    await userEvent.click(await screen.findByText('Update Widget'));

    expect(onSave).toHaveBeenCalledWith({index: 1, widget: expect.any(Object)});
  });

  it('passes undefined as the index for onSave if the index is not defined', async () => {
    jest.mocked(useParams).mockReturnValue({widgetIndex: undefined});

    const onSave = jest.fn();

    // This is the case where we're adding a new widget
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid
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
          isWidgetInvalid
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

  it('should render appropriate breadcrumbs if library widget is customized', async () => {
    const onSave = jest.fn();
    const {rerender} = render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid
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
          isWidgetInvalid
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={onSave}
          setIsPreviewDraggable={jest.fn()}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </WidgetBuilderProvider>
    );

    expect(await screen.findByText('Widget Library')).toBeInTheDocument();
    expect(await screen.findByText('Custom Widget Builder')).toBeInTheDocument();
  });

  it('should show deprecation alert when flag enabled', async () => {
    const organizationWithFeature = OrganizationFixture({
      features: [
        'discover-saved-queries-deprecation',
        'performance-transaction-deprecation-banner',
      ],
    });
    jest.mocked(useParams).mockReturnValue({widgetIndex: '1'});
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid={false}
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
          location: {
            pathname: '/dashboards/',
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
    jest.mocked(useParams).mockReturnValue({widgetIndex: '1'});
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid={false}
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

  it('should not show the query filter builder if the widget is an issue and a chart display type', () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid={false}
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
  });

  it('should not show the group by selector if the widget is an issue and a chart display type', () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{release: undefined}}
          isWidgetInvalid={false}
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
  });
});
