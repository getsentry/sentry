import {Group as GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ShortIdBreadrcumb} from './shortIdBreadcrumb';

describe('ShortIdBreadrcumb', function () {
  const {organization, project} = initializeOrg();
  const group = GroupFixture({shortId: 'ABC-123'});

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
  });

  it('renders short ID', function () {
    render(<ShortIdBreadrcumb {...{organization, project, group}} />);

    expect(screen.getByText('ABC-123')).toBeInTheDocument();
  });

  it('supports copy', async function () {
    render(<ShortIdBreadrcumb {...{organization, project, group}} />);

    async function clickMenuItem(name: string) {
      await userEvent.click(screen.getByRole('button', {name: 'Short-ID copy actions'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name}));
    }

    // Copy short ID
    await clickMenuItem('Copy Short-ID');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABC-123');

    // Copy short ID URL
    await clickMenuItem('Copy Issue URL');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'http://localhost/organizations/org-slug/issues/1/'
    );

    // Copy short ID Markdown
    await clickMenuItem('Copy Markdown Link');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      '[ABC-123](http://localhost/organizations/org-slug/issues/1/)'
    );
  });
});
