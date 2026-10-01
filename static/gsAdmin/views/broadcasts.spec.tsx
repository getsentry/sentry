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

  it('creates a broadcast from the modal footer', async () => {
    ConfigStore.loadInitialData(ConfigFixture({user: mockUser}));
    renderMockRequests();
    const create = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'POST',
      body: {id: '123'},
    });
    render(<Broadcasts />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'New Broadcast'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'A new feature');
    await userEvent.type(screen.getByRole('textbox', {name: 'Message'}), 'Try it now');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Link'}),
      'https://example.com'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      '/broadcasts/',
      expect.objectContaining({
        data: expect.objectContaining({title: 'A new feature', message: 'Try it now'}),
      })
    );
  });
});
