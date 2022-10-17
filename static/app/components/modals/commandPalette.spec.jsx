import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {openCommandPalette} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import FormSearchStore from 'sentry/stores/formSearchStore';
import App from 'sentry/views/app';

jest.mock('sentry/actionCreators/formSearch');
jest.mock('sentry/actionCreators/navigation');

describe('Command Palette Modal', function () {
  let orgsMock;

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
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/configs/',
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
    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
  });

  it('can open command palette modal and search', async function () {
    render(<App params={{orgId: 'org-slug'}}>{<div>placeholder content</div>}</App>, {
      context: TestStubs.routerContext([
        {
          router: TestStubs.router({
            params: {orgId: 'org-slug'},
          }),
        },
      ]),
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openCommandPalette({params: {orgId: 'org-slug'}});
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // NOTE: The `debounce` in `ApiSource` surprisingly only fires for the
    // first two typed characters of a sequence in most cases. This test only
    // types two characters to match in-app behaviour even though it's unclear
    // why it works that way
    userEvent.type(screen.getByRole('textbox'), 'bi');

    expect(orgsMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        // This nested 'query' is correct
        query: {query: 'bi'},
      })
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    const badges = screen.getAllByTestId('badge-display-name');

    expect(badges[0]).toHaveTextContent('billy-org Dashboard');
    expect(badges[1]).toHaveTextContent('billy-org Settings');

    userEvent.click(badges[0]);

    expect(navigateTo).toHaveBeenCalledWith('/billy-org/', expect.anything(), undefined);
  });
});
