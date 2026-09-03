import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {HomePage} from 'admin/views/home';

const US_URL = 'https://us.example.com/api/0/';

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

describe('HomePage project search', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.set('cells', [{name: 'us', locality_url: US_URL}]);
  });

  it('searches by bare project ID and navigates on select', async () => {
    const projectsMock = MockApiClient.addMockResponse({
      url: '/projects/',
      body: [projectResult],
    });

    const {router} = renderHomePage();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', {name: 'Projects (by ID)'}), '123');

    expect(await screen.findByText('my-org')).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledWith(
      '/projects/',
      expect.objectContaining({
        host: US_URL,
        query: {query: 'id:123', per_page: 10, show: 'all'},
      })
    );

    await user.click(screen.getByText('my-org'));
    expect(router.location.pathname).toBe('/_admin/customers/my-org/projects/my-proj/');
  });

  it('accepts an existing id: prefix', async () => {
    const projectsMock = MockApiClient.addMockResponse({
      url: '/projects/',
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
});
