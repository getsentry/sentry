import {DocIntegrationFixture} from 'getsentry-test/fixtures/docIntegration';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';

import DocIntegrationDetails from 'admin/views/docIntegrationDetails';
import DocIntegrations from 'admin/views/docIntegrations';

describe('Doc Integrations', function () {
  it('renders', function () {
    const {router, routerProps} = initializeOrg();

    MockApiClient.addMockResponse({
      url: '/doc-integrations/',
      method: 'GET',
      body: [],
    });

    render(<DocIntegrations {...routerProps} />, {router});

    expect(
      screen.getByRole('heading', {name: 'Document Integrations'})
    ).toBeInTheDocument();
  });
});

describe('Doc Integration Details', function () {
  const mockDocIntegration = DocIntegrationFixture({});
  const ENDPOINT = `/doc-integrations/${mockDocIntegration.slug}/`;

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', async function () {
    const {router} = initializeOrg({
      router: {
        params: {docIntegrationSlug: mockDocIntegration.slug},
      },
    });

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: mockDocIntegration,
    });

    render(<DocIntegrationDetails />, {router});

    expect(
      await screen.findByRole('heading', {name: 'Doc Integrations'})
    ).toBeInTheDocument();

    const terms = screen.getAllByRole('term');
    expect(terms[0]).toHaveTextContent('Name:');
    expect(terms[6]).toHaveTextContent('Popularity:');

    const definitions = screen.getAllByRole('definition');
    expect(definitions[0]).toHaveTextContent('hellboy');
    expect(definitions[6]).toHaveTextContent('8');
  });

  it('can delete', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');
    const {router} = initializeOrg({
      router: {
        params: {docIntegrationSlug: mockDocIntegration.slug},
      },
    });

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: mockDocIntegration,
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
    });

    render(<DocIntegrationDetails />, {router});

    expect(
      await screen.findByRole('heading', {name: 'Doc Integrations'})
    ).toBeInTheDocument();

    const button = screen.getByTestId('detail-actions');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    const deleteButton = screen.getByRole('option', {
      name: 'Delete Doc Integration 🚨 Delete this Doc Integration FOREVER (irreversible) 🚨',
    });

    expect(deleteButton).toBeEnabled();
    await userEvent.click(deleteButton);

    renderGlobalModal();
    const modal = screen.getByRole('dialog');
    const inModal = within(modal);

    await userEvent.click(
      inModal.getByRole('button', {
        name: 'Delete Doc Integration 😨',
      })
    );

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Resource has been deleted.'
    );

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('handles API errors when deleting', async function () {
    jest.spyOn(indicators, 'addErrorMessage');

    const {router} = initializeOrg({
      router: {
        params: {docIntegrationSlug: mockDocIntegration.slug},
      },
    });

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: mockDocIntegration,
    });

    const failedMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
      body: {
        detail: 'Test API error occurred.',
      },
      statusCode: 403,
    });

    render(<DocIntegrationDetails />, {router});
    expect(
      await screen.findByRole('heading', {name: 'Doc Integrations'})
    ).toBeInTheDocument();

    const button = screen.getByTestId('detail-actions');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    const deleteButton = screen.getByRole('option', {
      name: 'Delete Doc Integration 🚨 Delete this Doc Integration FOREVER (irreversible) 🚨',
    });

    expect(deleteButton).toBeEnabled();
    await userEvent.click(deleteButton);

    renderGlobalModal();
    const modal = screen.getByRole('dialog');
    const inModal = within(modal);

    await userEvent.click(
      inModal.getByRole('button', {
        name: 'Delete Doc Integration 😨',
      })
    );

    expect(indicators.addErrorMessage).toHaveBeenCalledWith(
      'There was an internal error with deleting the resource.'
    );

    expect(failedMock).toHaveBeenCalledWith(ENDPOINT, expect.anything());
  });

  it('can unpublish', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');
    const {router} = initializeOrg({
      router: {
        params: {docIntegrationSlug: mockDocIntegration.slug},
      },
    });

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: mockDocIntegration,
    });

    const updateMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      body: {
        is_draft: true,
        features: [],
      },
    });

    render(<DocIntegrationDetails />, {router});

    expect(
      await screen.findByRole('heading', {name: 'Doc Integrations'})
    ).toBeInTheDocument();

    const button = screen.getByTestId('detail-actions');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    const unpublishButton = screen.getByRole('option', {
      name: 'Unpublish App Revert This Doc Integration to Draft Mode',
    });

    expect(unpublishButton).toBeEnabled();
    await userEvent.click(unpublishButton);

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Resource has been updated with {"is_draft":true,"features":[]}.'
    );

    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
