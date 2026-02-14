import {DocIntegrationFixture} from 'getsentry-test/fixtures/docIntegration';
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

describe('Doc Integrations', () => {
  it('renders', () => {
    MockApiClient.addMockResponse({
      url: '/doc-integrations/',
      method: 'GET',
      body: [],
    });

    render(<DocIntegrations />);

    expect(
      screen.getByRole('heading', {name: 'Document Integrations'})
    ).toBeInTheDocument();
  });
});

describe('Doc Integration Details', () => {
  const mockDocIntegration = DocIntegrationFixture({});
  const ENDPOINT = `/doc-integrations/${mockDocIntegration.slug}/`;

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', async () => {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: mockDocIntegration,
    });

    render(<DocIntegrationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/doc-integrations/${mockDocIntegration.slug}/`,
        },
        route: `/admin/doc-integrations/:docIntegrationSlug/`,
      },
    });

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

  it('can delete', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: mockDocIntegration,
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
    });

    render(<DocIntegrationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/doc-integrations/${mockDocIntegration.slug}/`,
        },
        route: `/admin/doc-integrations/:docIntegrationSlug/`,
      },
    });

    expect(
      await screen.findByRole('heading', {name: 'Doc Integrations'})
    ).toBeInTheDocument();

    await userEvent.click(await screen.findByText('Doc Integrations Actions'));

    const deleteButton = await screen.findByText(
      /Delete this Doc Integration FOREVER \(irreversible\)/
    );

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

  it('handles API errors when deleting', async () => {
    jest.spyOn(indicators, 'addErrorMessage');

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

    render(<DocIntegrationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/doc-integrations/${mockDocIntegration.slug}/`,
        },
        route: `/admin/doc-integrations/:docIntegrationSlug/`,
      },
    });
    expect(
      await screen.findByRole('heading', {name: 'Doc Integrations'})
    ).toBeInTheDocument();

    const button = await screen.findByText('Doc Integrations Actions');
    await userEvent.click(button);

    const deleteButton = await screen.findByText(
      /Delete this Doc Integration FOREVER \(irreversible\)/
    );

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

  it('can unpublish', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');

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

    render(<DocIntegrationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/doc-integrations/${mockDocIntegration.slug}/`,
        },
        route: `/admin/doc-integrations/:docIntegrationSlug/`,
      },
    });

    expect(
      await screen.findByRole('heading', {name: 'Doc Integrations'})
    ).toBeInTheDocument();

    await userEvent.click(await screen.findByText('Doc Integrations Actions'));

    const unpublishButton = await screen.findByText(
      'Revert This Doc Integration to Draft Mode'
    );

    await userEvent.click(unpublishButton);

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Resource has been updated with {"is_draft":true,"features":[]}.'
    );

    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
