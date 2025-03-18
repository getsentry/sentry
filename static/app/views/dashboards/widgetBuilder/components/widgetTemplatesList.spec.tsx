import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useNavigate} from 'sentry/utils/useNavigate';
import WidgetTemplatesList from 'sentry/views/dashboards/widgetBuilder/components/widgetTemplatesList';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

vi.mock('sentry/utils/useNavigate', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('sentry/views/dashboards/widgetLibrary/data', () => ({
  getTopNConvertedDefaultWidgets: vi.fn(() => [
    {
      id: 'duration-distribution',
      title: 'Duration Distribution',
      description: 'some description',
      displayType: 'line',
      widgetType: 'transactions-like',
      queries: [],
    },
  ]),
}));

const mockUseNavigate = vi.mocked(useNavigate);

const router = RouterFixture({
  location: LocationFixture({query: {}}),
});

vi.mock('sentry/actionCreators/indicator');

describe('WidgetTemplatesList', () => {
  const onSave = vi.fn();

  beforeEach(() => {
    const mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      body: {},
      statusCode: 400,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render the widget templates list', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={vi.fn()}
          setIsPreviewDraggable={vi.fn()}
        />
      </WidgetBuilderProvider>
    );

    expect(await screen.findByText('Duration Distribution')).toBeInTheDocument();
    expect(await screen.findByText('some description')).toBeInTheDocument();
  });

  it('should render buttons when the user clicks on a widget template', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={vi.fn()}
          setIsPreviewDraggable={vi.fn()}
        />
      </WidgetBuilderProvider>
    );

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await userEvent.click(widgetTemplate);

    expect(await screen.findByText('Customize')).toBeInTheDocument();
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });

  it('should put widget in url when clicking a template', async () => {
    const mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={vi.fn()}
          setIsPreviewDraggable={vi.fn()}
        />
      </WidgetBuilderProvider>,
      {router}
    );

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await userEvent.click(widgetTemplate);

    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({
          description: 'some description',
          title: 'Duration Distribution',
          displayType: 'line',
          dataset: 'transactions-like',
        }),
      }),
      {replace: true}
    );
  });

  it('should show error message when the widget fails to save', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={vi.fn()}
          setIsPreviewDraggable={vi.fn()}
        />
      </WidgetBuilderProvider>
    );

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await userEvent.click(widgetTemplate);

    await userEvent.click(await screen.findByText('Add to dashboard'));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('Unable to add widget');
    });

    // show we're still on the widget templates list
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });
});
