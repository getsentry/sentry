import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

const mockUseNavigate = jest.mocked(useNavigate);

const router = RouterFixture({
  location: LocationFixture({query: {}}),
});

describe('WidgetTemplatesList', () => {
  beforeEach(() => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the widget templates list', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList changeBuilderView={jest.fn()} />
      </WidgetBuilderProvider>
    );

    expect(await screen.findByText('Duration Distribution')).toBeInTheDocument();
    expect(await screen.findByText('some description')).toBeInTheDocument();
  });

  it('should render buttons when the user clicks on a widget template', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList changeBuilderView={jest.fn()} />
      </WidgetBuilderProvider>
    );

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await userEvent.click(widgetTemplate);

    expect(await screen.findByText('Customize')).toBeInTheDocument();
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });

  it('should put widget in url when clicking a template', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList changeBuilderView={jest.fn()} />
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
      })
    );
  });
});
