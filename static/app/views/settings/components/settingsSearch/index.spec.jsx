import {Members} from 'fixtures/js-stubs/members';
import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {router} from 'fixtures/js-stubs/router';
import {routerContext} from 'fixtures/js-stubs/routerContext';
import {Team} from 'fixtures/js-stubs/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {navigateTo} from 'sentry/actionCreators/navigation';
import FormSearchStore from 'sentry/stores/formSearchStore';
import SettingsSearch from 'sentry/views/settings/components/settingsSearch';

jest.mock('sentry/actionCreators/formSearch');
jest.mock('sentry/actionCreators/navigation');

describe('SettingsSearch', function () {
  let orgsMock;
  const routerContext = routerContext([
    {
      router: router({
        params: {orgId: 'org-slug'},
      }),
    },
  ]);

  beforeEach(function () {
    FormSearchStore.loadSearchMap([]);
    MockApiClient.clearMockResponses();
    orgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [Organization({slug: 'billy-org', name: 'billy org'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      body: [Project({slug: 'foo-project'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      query: 'foo',
      body: [Team({slug: 'foo-team'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      query: 'foo',
      body: Members(),
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
    render(<SettingsSearch params={{orgId: 'org-slug'}} />);

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
