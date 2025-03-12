import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import ModalStore from 'sentry/stores/modalStore';

import Broadcasts from 'admin/views/broadcasts';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/broadcasts/?show=all',
    body: [],
  });
}

describe('Broadcasts', function () {
  const mockUser = UserFixture({permissions: new Set(['broadcasts.admin'])});

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('renders', async function () {
    const {router} = initializeOrg();

    ConfigStore.loadInitialData(
      ConfigFixture({
        user: mockUser,
      })
    );

    renderMockRequests();

    render(
      <Broadcasts
        location={router.location}
        router={router}
        params={router.params}
        route={router.routes[0]!}
        routeParams={router.params}
        routes={router.routes}
      />
    );

    renderGlobalModal();

    await userEvent.click(screen.getByText('New Broadcast'));

    expect(await screen.findByRole('textbox', {name: 'Image URL'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Category'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Product'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'CTA'})).not.toBeInTheDocument();
  });
});
