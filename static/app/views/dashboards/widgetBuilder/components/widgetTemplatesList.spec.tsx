import debounce from 'lodash/debounce';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {testableDebounce} from 'sentry/utils/url/testUtils';
import {useNavigate} from 'sentry/utils/useNavigate';
import WidgetTemplatesList from 'sentry/views/dashboards/widgetBuilder/components/widgetTemplatesList';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));
jest.mock('lodash/debounce');

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

jest.mock('sentry/actionCreators/indicator');

describe('WidgetTemplatesList', () => {
  const onSave = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();

    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    jest.mocked(debounce).mockImplementation(testableDebounce);

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
      </WidgetBuilderProvider>
    );

    expect(await screen.findByText('Duration Distribution')).toBeInTheDocument();
    expect(await screen.findByText('some description')).toBeInTheDocument();
  });

  it('should render buttons when the user clicks on a widget template', async () => {
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          setCustomizeFromLibrary={jest.fn()}
        />
      </WidgetBuilderProvider>
    );

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await user.click(widgetTemplate);

    jest.runAllTimers();

    expect(await screen.findByText('Customize')).toBeInTheDocument();
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });

  it('should put widget in url when clicking a template', async () => {
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          setCustomizeFromLibrary={jest.fn()}
        />
      </WidgetBuilderProvider>
    );

    const widgetTemplate = screen.getByText('Duration Distribution');
    await user.click(widgetTemplate);

    jest.runAllTimers();

    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
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
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

    render(
      <WidgetBuilderProvider>
        <WidgetTemplatesList
          onSave={onSave}
          setOpenWidgetTemplates={jest.fn()}
          setIsPreviewDraggable={jest.fn()}
          setCustomizeFromLibrary={jest.fn()}
        />
      </WidgetBuilderProvider>
    );

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await user.click(widgetTemplate);

    await user.click(await screen.findByText('Add to dashboard'));

    jest.runAllTimers();

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('Unable to add widget');
    });

    // show we're still on the widget templates list
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });
});
