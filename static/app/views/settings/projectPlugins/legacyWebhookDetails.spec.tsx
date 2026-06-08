import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import LegacyWebhookDetails from 'sentry/views/settings/projectPlugins/legacyWebhookDetails';

describe('LegacyWebhookDetails', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function renderComponent() {
    return render(<LegacyWebhookDetails />, {
      organization,
      outletContext: {project},
    });
  }

  it('renders the full page with header and warning banner', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: ['https://example.com/hook1'], enabled: true},
    });

    renderComponent();

    expect(await screen.findByText(/strongly recommend using an/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Disable'})).toBeInTheDocument();
  });

  it('renders webhook URLs in textarea', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {
        urls: ['https://example.com/hook1', 'https://example.com/hook2'],
        enabled: true,
      },
    });

    renderComponent();

    const textarea = await screen.findByPlaceholderText(
      'Enter callback URLs (one per line)'
    );
    expect(textarea).toHaveValue('https://example.com/hook1\nhttps://example.com/hook2');
  });

  it('renders empty textarea when no URLs configured', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: [], enabled: true},
    });

    renderComponent();

    const textarea = await screen.findByPlaceholderText(
      'Enter callback URLs (one per line)'
    );
    expect(textarea).toHaveValue('');
  });

  it('shows loading error on fetch failure', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      statusCode: 500,
      body: {},
    });

    renderComponent();

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('saves URLs on save button click', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: ['https://example.com/hook1'], enabled: true},
    });

    const saveMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'POST',
      body: {
        urls: ['https://example.com/hook1', 'https://example.com/new'],
        enabled: true,
      },
    });

    renderComponent();

    const textarea = await screen.findByPlaceholderText(
      'Enter callback URLs (one per line)'
    );

    await userEvent.type(textarea, '\nhttps://example.com/new');
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Webhook URLs saved successfully.'
    );
  });

  it('disables save button when no changes made', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: ['https://example.com/hook1'], enabled: true},
    });

    renderComponent();

    await screen.findByPlaceholderText('Enter callback URLs (one per line)');
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeDisabled();
  });

  it('sends test event on test button click', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: ['https://example.com/hook1'], enabled: true},
    });

    const testMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/test-fire-actions/`,
      method: 'POST',
      body: null,
    });

    renderComponent();

    await screen.findByPlaceholderText('Enter callback URLs (one per line)');
    await userEvent.click(screen.getByRole('button', {name: 'Send Test Event'}));

    await waitFor(() => expect(testMock).toHaveBeenCalled());
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Test event sent successfully.'
    );
  });

  it('disables test button when webhooks are disabled', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: ['https://example.com/hook1'], enabled: false},
    });

    renderComponent();

    await screen.findByPlaceholderText('Enter callback URLs (one per line)');
    expect(screen.getByRole('button', {name: 'Send Test Event'})).toBeDisabled();
  });

  it('toggles webhook enabled state', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: ['https://example.com/hook'], enabled: false},
    });

    const postMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'POST',
      body: {urls: ['https://example.com/hook'], enabled: true},
    });

    renderComponent();

    await userEvent.click(await screen.findByRole('button', {name: 'Enable'}));

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Webhooks enabled');
  });

  it('shows disable button when enabled', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: ['https://example.com/hook'], enabled: true},
    });

    renderComponent();

    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();
  });

  it('shows error on save failure', async () => {
    jest.spyOn(indicators, 'addErrorMessage');

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'GET',
      body: {urls: ['https://example.com/hook1'], enabled: true},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
      method: 'POST',
      statusCode: 400,
      body: {urls: ['Invalid URL format.']},
    });

    renderComponent();

    const textarea = await screen.findByPlaceholderText(
      'Enter callback URLs (one per line)'
    );

    await userEvent.type(textarea, '\nnot-a-url');
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Unable to save webhook URLs.'
      )
    );
  });
});
