import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {NumericDropdownFilter} from './numericDropdownFilter';

describe('NumericDropdownFilter', () => {
  it('adds the filter to the existing URL query when an action is selected', async () => {
    const {router} = render(<NumericDropdownFilter type="count_errors" val={3} />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/replays/',
          query: {query: 'browser.name:Chrome', project: '1'},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Show values greater than'})
    );

    await waitFor(() =>
      expect(router.location.query).toEqual({
        query: 'browser.name:Chrome count_errors:>3',
        project: '1',
      })
    );
  });
});
