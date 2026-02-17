import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import Broadcasts from 'admin/views/broadcasts';

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
});
