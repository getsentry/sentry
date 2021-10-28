import {
  fireEvent,
  mountWithTheme,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {navigateTo} from 'app/actionCreators/navigation';
import FormSearchStore from 'app/stores/formSearchStore';
import SettingsSearch from 'app/views/settings/components/settingsSearch';

jest.mock('app/actionCreators/formSearch');
jest.mock('app/actionCreators/navigation');

describe('SettingsSearch', function () {
  let orgsMock;
  const routerContext = TestStubs.routerContext([
    {
      router: TestStubs.router({
        params: {orgId: 'org-slug'},
      }),
    },
  ]);

  beforeEach(function () {
    FormSearchStore.onLoadSearchMap([]);
    MockApiClient.clearMockResponses();
    orgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization({slug: 'billy-org', name: 'billy org'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      body: [TestStubs.Project({slug: 'foo-project'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      query: 'foo',
      body: [TestStubs.Team({slug: 'foo-team'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      query: 'foo',
      body: TestStubs.Members(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/?plugins=_all',
      query: 'foo',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/configs/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      query: 'foo',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/sentry-apps/?status=published',
      body: [],
    });
  });

  it('renders', async function () {
    mountWithTheme(<SettingsSearch params={{orgId: 'org-slug'}} />);

    // renders input
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('can focus when hotkey is pressed', function () {
    mountWithTheme(<SettingsSearch params={{orgId: 'org-slug'}} />);

    fireEvent.keyDown(document, {code: 'Slash', key: '/', keyCode: 191});
    expect(screen.getByPlaceholderText('Search')).toHaveFocus();
  });

  it('can search', async function () {
    mountWithTheme(<SettingsSearch params={{orgId: 'org-slug'}} />, {
      context: routerContext,
    });

    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, {target: {value: 'bil'}});

    await tick();

    expect(orgsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // This nested 'query' is correct
        query: {query: 'bil'},
      })
    );

    const results = screen.getAllByTestId('badge-display-name');

    const firstResult = results
      .filter(e => e.textContent === 'billy-org Dashboard')
      .pop();

    expect(firstResult).toBeDefined();

    userEvent.click(firstResult);
    expect(navigateTo).toHaveBeenCalledWith('/billy-org/', expect.anything(), undefined);
  });
});
