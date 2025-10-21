import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useNavigate} from 'sentry/utils/useNavigate';
import WidgetTemplatesList from 'sentry/views/dashboards/widgetBuilder/components/widgetTemplatesList';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('sentry/views/dashboards/widgetLibrary/data', () => ({
  getTopNConvertedDefaultWidgets: jest.fn(() => [
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

jest.mock('lodash/debounce', () =>
  jest.fn().mockImplementation((callback, timeout) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const debounced = jest.fn((...args) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(...args), timeout);
    });

    const cancel = jest.fn(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    const flush = jest.fn(() => {
      if (timeoutId) clearTimeout(timeoutId);
      callback();
    });

    // @ts-expect-error mock lodash debounce
    debounced.cancel = cancel;
    // @ts-expect-error mock lodash debounce
    debounced.flush = flush;
    return debounced;
  })
);

const mockUseNavigate = jest.mocked(useNavigate);

const router = RouterFixture({
  location: LocationFixture({query: {}}),
});

jest.mock('sentry/actionCreators/indicator');

describe('WidgetTemplatesList', () => {
  const onSave = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();

    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      body: {},
      statusCode: 400,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render the widget templates list', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          setCustomizeFromLibrary={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        deprecatedRouterMocks: true,
      }
    );

    expect(await screen.findByText('Duration Distribution')).toBeInTheDocument();
    expect(await screen.findByText('some description')).toBeInTheDocument();
  });

  it('should render buttons when the user clicks on a widget template', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          setCustomizeFromLibrary={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        deprecatedRouterMocks: true,
      }
    );

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await userEvent.click(widgetTemplate);

    expect(await screen.findByText('Customize')).toBeInTheDocument();
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });

  it('should put widget in url when clicking a template', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          setCustomizeFromLibrary={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        router,
        deprecatedRouterMocks: true,
      }
    );

    const widgetTemplate = screen.getByText('Duration Distribution');
    await user.click(widgetTemplate);

    act(() => {
      jest.runAllTimers();
    });

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
      expect.anything()
    );
  });

  it('should show error message when the widget fails to save', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          setCustomizeFromLibrary={jest.fn()}
        />
      </WidgetBuilderProvider>,
      {
        deprecatedRouterMocks: true,
      }
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
