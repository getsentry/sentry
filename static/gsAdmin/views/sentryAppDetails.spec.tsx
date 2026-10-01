import {Fragment} from 'react';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

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

  render(
    <Fragment>
      <SentryAppDetails />
      <GlobalModal />
    </Fragment>,
    {
      initialRouterConfig: {
        location: {pathname: `/_admin/sentry-apps/${sentryApp.slug}/`},
        route: '/_admin/sentry-apps/:sentryAppSlug/',
      },
    }
  );

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

    await userEvent.click(
      await screen.findByRole('button', {name: 'Sentry Apps Actions'})
    );
    expect(await screen.findByText('Disable App')).toBeInTheDocument();
    expect(screen.queryByText('disabled')).not.toBeInTheDocument();
  });

  it('shows enable action and disabled badge for a disabled app', async () => {
    renderSentryAppDetails({isDisabled: true});

    expect(await screen.findByText('disabled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Sentry Apps Actions'}));
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

    const putMock = MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      method: 'PUT',
      body: {...sentryApp, isDisabled: true},
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Sentry Apps Actions'})
    );
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

  it('refreshes the app details after updating them', async () => {
    const sentryApp = renderSentryAppDetails({
      popularity: 10,
      featureData: [],
    });
    MockApiClient.addMockResponse({url: '/integration-features/', body: []});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Sentry Apps Actions'})
    );
    await userEvent.click(await screen.findByRole('option', {name: /Update Details/}));

    const updatedSentryApp = {...sentryApp, popularity: 20};
    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      method: 'PUT',
      body: updatedSentryApp,
    });
    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      method: 'GET',
      body: updatedSentryApp,
    });

    const popularity = await screen.findByRole('spinbutton', {
      name: 'New popularity',
    });
    await userEvent.clear(popularity);
    await userEvent.type(popularity, '20');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByText('20')).toBeInTheDocument();
  });
});
