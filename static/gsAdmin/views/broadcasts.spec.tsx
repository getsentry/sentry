import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {Broadcasts} from 'admin/views/broadcasts';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/broadcasts/?show=all',
    body: [],
  });
}

describe('Broadcasts', () => {
  const mockUser = UserFixture({permissions: new Set(['broadcasts.admin'])});

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', async () => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: mockUser,
      })
    );

    renderMockRequests();

    render(<Broadcasts />);

    renderGlobalModal();

    await userEvent.click(screen.getByText('New Broadcast'));

    expect(await screen.findByRole('textbox', {name: 'Image URL'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Category'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Product'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'CTA'})).not.toBeInTheDocument();
  });

  it('omits organizations when creating a broadcast without organization IDs', async () => {
    ConfigStore.loadInitialData(ConfigFixture({user: mockUser}));
    renderMockRequests();
    const createRequest = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'POST',
      body: {id: '1'},
    });

    render(<Broadcasts />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'New Broadcast'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'Test broadcast');
    await userEvent.type(screen.getByRole('textbox', {name: 'Message'}), 'Test message');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Link'}),
      'https://example.com'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => expect(createRequest).toHaveBeenCalled());
    const requestData = createRequest.mock.calls[0]?.[1]?.data;
    expect(JSON.parse(JSON.stringify(requestData))).not.toHaveProperty('organizations');
  });
});
