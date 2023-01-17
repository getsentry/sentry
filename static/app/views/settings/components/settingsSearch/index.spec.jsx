import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {navigateTo} from 'sentry/actionCreators/navigation';
import FormSearchStore from 'sentry/stores/formSearchStore';
import SettingsSearch from 'sentry/views/settings/components/settingsSearch';

jest.mock('sentry/actionCreators/formSearch');
jest.mock('sentry/actionCreators/navigation');

describe('SettingsSearch', function () {
  let orgsMock;
  const routerContext = TestStubs.routerContext([
    {
      router: TestStubs.router({
        params: {},
      }),
    },
  ]);

  beforeEach(function () {
    FormSearchStore.loadSearchMap([]);
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
    MockApiClient.addMockResponse({
      url: '/doc-integrations/',
      body: [],
    });
  });

  it('renders', function () {
    render(<SettingsSearch params={{}} />);

    // renders input
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('can focus when hotkey is pressed', function () {
    render(<SettingsSearch />);
    userEvent.keyboard('/', {keyboardMap: [{code: 'Slash', key: '/', keyCode: 191}]});
    expect(screen.getByPlaceholderText('Search')).toHaveFocus();
  });

  it('can search', async function () {
    render(<SettingsSearch />, {
      context: routerContext,
    });

    userEvent.type(screen.getByPlaceholderText('Search'), 'bil{enter}');

    expect(orgsMock.mock.calls).toEqual([
      [
        '/organizations/',
        expect.objectContaining({
          // This nested 'query' is correct
          query: {query: 'b'},
        }),
      ],
      [
        '/organizations/',
        expect.objectContaining({
          // This nested 'query' is correct
          query: {query: 'bi'},
        }),
      ],
    ]);

    userEvent.click(
      await screen.findByText(textWithMarkupMatcher('billy-org Dashboard'))
    );

    expect(navigateTo).toHaveBeenCalledWith('/billy-org/', expect.anything(), undefined);
  });
});
