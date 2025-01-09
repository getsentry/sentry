import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ModalStore from 'sentry/stores/modalStore';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import WidgetBuilderSlideout from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/utils/useCustomMeasurements');
jest.mock('sentry/views/explore/contexts/spanTagsContext');
jest.mock('sentry/actionCreators/indicator');

describe('WidgetBuilderSlideout', () => {
  let organization!: ReturnType<typeof OrganizationFixture>;
  beforeEach(() => {
    organization = OrganizationFixture();

    jest.mocked(useCustomMeasurements).mockReturnValue({
      customMeasurements: {},
    });

    jest.mocked(useSpanTags).mockReturnValue({});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      body: {
        title: 'Title is required during creation',
      },
      statusCode: 400,
    });
  });

  afterEach(() => {
    ModalStore.reset();
  });

  it('should show the sort by step if the widget is a chart and there are fields selected', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{
            release: undefined,
          }}
          isWidgetInvalid={false}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          isOpen
        />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['project'],
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
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
          dashboardFilters={{
            release: undefined,
          }}
          isWidgetInvalid={false}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          isOpen
        />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: [],
              yAxis: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    expect(await screen.findByText('Sort by')).toBeInTheDocument();
  });

  it('should not show the sort by step if the widget is a chart without fields', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderSlideout
          dashboard={DashboardFixture([])}
          dashboardFilters={{
            release: undefined,
          }}
          isWidgetInvalid={false}
          onClose={jest.fn()}
          onQueryConditionChange={jest.fn()}
          onSave={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          isOpen
        />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: [],
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
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
          isOpen
        />
      </WidgetBuilderProvider>,
      {organization}
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
          isOpen
        />
      </WidgetBuilderProvider>,
      {organization}
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
          isOpen
        />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: [],
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
              title: undefined,
            },
          }),
        }),
      }
    );

    await userEvent.click(await screen.findByText('Add Widget'));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('Unable to save widget');
    });

    expect(screen.getByText('Create Custom Widget')).toBeInTheDocument();
  });

  it('clears the alias when dataset or display type changes', async () => {
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
          isOpen
        />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              field: ['count()'],
              yAxis: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );

    await userEvent.type(await screen.findByPlaceholderText('Add Alias'), 'test alias');
    await userEvent.click(screen.getByText('Errors'));

    expect(await screen.findByPlaceholderText('Add Alias')).toHaveValue('');

    await userEvent.type(
      await screen.findByPlaceholderText('Add Alias'),
      'test alias again'
    );

    await userEvent.click(screen.getByText('Table'));
    await userEvent.click(screen.getByText('Area'));
    await userEvent.click(screen.getByText('Area'));
    await userEvent.click(screen.getByText('Table'));

    expect(await screen.findByPlaceholderText('Add Alias')).toHaveValue('');
  });
});
