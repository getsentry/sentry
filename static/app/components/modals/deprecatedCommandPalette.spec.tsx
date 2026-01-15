import {MembersFixture} from 'sentry-fixture/members';
import {OrganizationsFixture} from 'sentry-fixture/organizations';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import CommandPaletteModal from 'sentry/components/modals/deprecatedCommandPalette';
import OrganizationsStore from 'sentry/stores/organizationsStore';

jest.mock('sentry/actionCreators/navigation');

describe('Command Palette Modal', () => {
  it('can open command palette modal and search', async () => {
    OrganizationsStore.load(OrganizationsFixture());

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({slug: 'foo-project'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TeamFixture({slug: 'foo-team'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: MembersFixture(),
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
      url: '/assistant/',
      body: [],
    });

    render(
      <CommandPaletteModal
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
      />
    );

    await userEvent.type(screen.getByRole('textbox'), 'test');

    const badges = await screen.findAllByTestId('badge-display-name');

    expect(badges[0]).toHaveTextContent('test 1');
    expect(badges[1]).toHaveTextContent('test 2');

    await userEvent.click(badges[0]!);

    expect(navigateTo).toHaveBeenCalledWith('/test-1/', expect.anything(), undefined);
  });
});
