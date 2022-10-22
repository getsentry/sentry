import {Members} from 'fixtures/js-stubs/members';
import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {router} from 'fixtures/js-stubs/router';
import {routerContext} from 'fixtures/js-stubs/routerContext';
import {Team} from 'fixtures/js-stubs/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import CommandPaletteModal from 'sentry/components/modals/commandPalette';
import FormSearchStore from 'sentry/stores/formSearchStore';

jest.mock('sentry/actionCreators/formSearch');
jest.mock('sentry/actionCreators/navigation');

function renderMockRequests() {
  FormSearchStore.loadSearchMap([]);

  const organization = MockApiClient.addMockResponse({
    url: '/organizations/',
    body: [Organization({slug: 'billy-org', name: 'billy org'})],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    body: [Project({slug: 'foo-project'})],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/teams/',
    body: [Team({slug: 'foo-team'})],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/members/',
    body: Members(),
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

  return {organization};
}

describe('Command Palette Modal', function () {
  it('can open command palette modal and search', async function () {
    const mockRequests = renderMockRequests();

    render(
      <CommandPaletteModal
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
      />,
      {
        context: routerContext([
          {
            router: router({
              params: {orgId: 'org-slug'},
            }),
          },
        ]),
      }
    );

    // NOTE: The `debounce` in `ApiSource` surprisingly only fires for the
    // first two typed characters of a sequence in most cases. This test only
    // types two characters to match in-app behaviour even though it's unclear
    // why it works that way
    userEvent.type(screen.getByRole('textbox'), 'bi');

    expect(mockRequests.organization).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        // This nested 'query' is correct
        query: {query: 'bi'},
      })
    );

    const badges = await screen.findAllByTestId('badge-display-name');

    expect(badges[0]).toHaveTextContent('billy-org Dashboard');
    expect(badges[1]).toHaveTextContent('billy-org Settings');

    userEvent.click(badges[0]);

    expect(navigateTo).toHaveBeenCalledWith('/billy-org/', expect.anything(), undefined);
  });
});
