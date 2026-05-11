import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {SentryAppDetails} from 'admin/views/sentryAppDetails';

function renderSentryAppDetails(overrides: Record<string, any> = {}) {
  const sentryApp = {
    ...SentryAppFixture({slug: 'test-app', status: 'unpublished'}),
    owner: {slug: 'test-org'},
    isDisabled: false,
    ...overrides,
  };

  MockApiClient.addMockResponse({
    url: `/sentry-apps/${sentryApp.slug}/`,
    method: 'GET',
    body: sentryApp,
  });

  render(<SentryAppDetails />, {
    initialRouterConfig: {
      location: {pathname: `/_admin/sentry-apps/${sentryApp.slug}/`},
      route: '/_admin/sentry-apps/:sentryAppSlug/',
    },
  });

  return sentryApp;
}

describe('SentryAppDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders an unpublished app without crashing', async () => {
    renderSentryAppDetails();

    expect(await screen.findByRole('heading', {name: 'Sentry Apps'})).toBeInTheDocument();
    expect(screen.getAllByText('unpublished')).not.toHaveLength(0);
  });

  it('shows disable action for a non-disabled app', async () => {
    renderSentryAppDetails({isDisabled: false});

    await userEvent.click(await screen.findByTestId('detail-actions'));
    expect(await screen.findByText('Disable App')).toBeInTheDocument();
    expect(screen.queryByText('disabled')).not.toBeInTheDocument();
  });

  it('shows enable action and disabled badge for a disabled app', async () => {
    renderSentryAppDetails({isDisabled: true});

    expect(await screen.findByText('disabled')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('detail-actions'));
    expect(await screen.findByText('Enable App')).toBeInTheDocument();
  });

  it('shows Enabled: yes for a non-disabled app', async () => {
    renderSentryAppDetails({isDisabled: false});

    expect(await screen.findByText('Enabled:')).toBeInTheDocument();
    expect(screen.getByText('yes')).toBeInTheDocument();
  });

  it('shows Enabled: no for a disabled app', async () => {
    renderSentryAppDetails({isDisabled: true});

    expect(await screen.findByText('Enabled:')).toBeInTheDocument();
    expect(screen.getAllByText('no')).toHaveLength(2);
  });

  it('sends PUT with isDisabled when disable action is confirmed', async () => {
    const sentryApp = renderSentryAppDetails({isDisabled: false});
    renderGlobalModal();

    const putMock = MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      method: 'PUT',
      body: {...sentryApp, isDisabled: true},
    });

    await userEvent.click(await screen.findByTestId('detail-actions'));
    await userEvent.click(await screen.findByRole('option', {name: /Disable App/}));
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({data: {isDisabled: true}})
      );
    });

    expect(await screen.findByText('disabled')).toBeInTheDocument();
  });
});
