import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {HomePage} from 'admin/views/home';

const US_URL = 'https://us.example.com/api/0/';
const DE_URL = 'https://de.example.com/api/0/';

const projectResult = {
  id: '123',
  slug: 'my-proj',
  organization: {slug: 'my-org'},
};

function renderHomePage() {
  return render(<HomePage />, {
    initialRouterConfig: {
      location: {pathname: '/_admin/'},
      route: '/_admin/',
    },
  });
}

beforeEach(() => {
  MockApiClient.clearMockResponses();
  ConfigStore.set('cells', [
    {name: 'us', locality_url: US_URL},
    {name: 'de', locality_url: DE_URL},
  ]);
});

describe('HomePage project search', () => {
  it('finds a project in any region and navigates on select', async () => {
    const usMock = MockApiClient.addMockResponse({
      url: '/projects/',
      host: US_URL,
      body: [],
    });
    const deMock = MockApiClient.addMockResponse({
      url: '/projects/',
      host: DE_URL,
      body: [projectResult],
    });

    const {router} = renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Projects (by ID)'}), '123');

    expect(await screen.findByText('my-org')).toBeInTheDocument();
    for (const [mock, host] of [
      [usMock, US_URL],
      [deMock, DE_URL],
    ] as const) {
      expect(mock).toHaveBeenCalledWith(
        '/projects/',
        expect.objectContaining({
          host,
          query: {query: 'id:123', per_page: 10, show: 'all'},
        })
      );
    }

    await user.click(screen.getByText('my-org'));
    expect(router.location.pathname).toBe('/_admin/customers/my-org/projects/my-proj/');
  });

  it('accepts an existing id: prefix', async () => {
    MockApiClient.addMockResponse({url: '/projects/', host: DE_URL, body: []});
    const projectsMock = MockApiClient.addMockResponse({
      url: '/projects/',
      host: US_URL,
      body: [projectResult],
    });

    renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Projects (by ID)'}), 'id:123');

    expect(await screen.findByText('my-org')).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledWith(
      '/projects/',
      expect.objectContaining({
        query: expect.objectContaining({query: 'id:123'}),
      })
    );
  });

  it('does not query for input without a valid ID', async () => {
    const projectsMock = MockApiClient.addMockResponse({
      url: '/projects/',
      body: [projectResult],
    });

    renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Projects (by ID)'}), 'my-proj');

    expect(await screen.findByText('No results found')).toBeInTheDocument();
    expect(projectsMock).not.toHaveBeenCalled();
  });

  it('still shows a result when another region fails', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/',
      host: US_URL,
      statusCode: 500,
      body: {detail: 'boom'},
    });
    MockApiClient.addMockResponse({
      url: '/projects/',
      host: DE_URL,
      body: [projectResult],
    });

    renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Projects (by ID)'}), '123');

    expect(await screen.findByText('my-org')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports an error when a region fails and nothing was found', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/',
      host: US_URL,
      statusCode: 500,
      body: {detail: 'boom'},
    });
    MockApiClient.addMockResponse({
      url: '/projects/',
      host: DE_URL,
      body: [],
    });

    renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Projects (by ID)'}), '123');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('HomePage organization search', () => {
  it('merges organizations from every region', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      host: US_URL,
      body: [{id: '1', slug: 'acme-us', name: 'Acme US'}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      host: DE_URL,
      body: [{id: '2', slug: 'acme-de', name: 'Acme DE'}],
    });

    const {router} = renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Organizations'}), 'acme');

    expect(await screen.findByText('acme-us')).toBeInTheDocument();
    expect(screen.getByText('acme-de')).toBeInTheDocument();

    await user.click(screen.getByText('acme-de'));
    expect(router.location.pathname).toBe('/_admin/customers/acme-de/');
  });

  it('searches all regions on the customers page', async () => {
    MockApiClient.addMockResponse({url: '/_admin/cells/us/customers/', body: []});
    MockApiClient.addMockResponse({url: '/_admin/cells/de/customers/', body: []});

    const {router} = renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Organizations'}), 'acme');
    await user.click(await screen.findByText('Search organizations for "acme"'));

    expect(router.location.pathname).toBe('/_admin/customers/');
    expect(router.location.query).toEqual({query: 'acme'});
  });
});

describe('HomePage invoice lookup', () => {
  const invoiceId = '357f1bf2565a4b1bbdfb18fe6700e196';

  it('opens the invoice in the region that has it', async () => {
    MockApiClient.addMockResponse({
      url: `/_admin/cells/us/admin-invoices/${invoiceId}/`,
      host: US_URL,
      statusCode: 404,
      body: {detail: 'not found'},
    });
    MockApiClient.addMockResponse({
      url: `/_admin/cells/de/admin-invoices/${invoiceId}/`,
      host: DE_URL,
      body: {id: invoiceId},
    });

    const {router} = renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Invoices'}), invoiceId);
    await user.click(screen.getByRole('button', {name: 'Open invoice'}));

    await waitFor(() =>
      expect(router.location.pathname).toBe(`/_admin/invoices/de/${invoiceId}/`)
    );
  });

  it('reports when no region has the invoice', async () => {
    MockApiClient.addMockResponse({
      url: `/_admin/cells/us/admin-invoices/${invoiceId}/`,
      statusCode: 404,
      body: {detail: 'not found'},
    });
    MockApiClient.addMockResponse({
      url: `/_admin/cells/de/admin-invoices/${invoiceId}/`,
      statusCode: 404,
      body: {detail: 'not found'},
    });

    const {router} = renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Invoices'}), invoiceId);
    await user.click(screen.getByRole('button', {name: 'Open invoice'}));

    expect(
      await screen.findByText('No invoice with this ID exists in any region')
    ).toBeInTheDocument();
    expect(router.location.pathname).toBe('/_admin/');
  });
});
