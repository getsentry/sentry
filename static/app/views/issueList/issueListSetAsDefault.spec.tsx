import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {SavedSearchType, SavedSearchVisibility} from 'sentry/types';
import IssueListSetAsDefault from 'sentry/views/issueList/issueListSetAsDefault';

describe('IssueListSetAsDefault', () => {
  const organization = TestStubs.Organization({
    features: ['issue-list-saved-searches-v2'],
  });

  const {router} = initializeOrg();

  const routerProps = {
    params: router.params,
    location: router.location,
  };

  const defaultProps = {
    organization,
    savedSearch: null,
    query: 'is:unresolved',
    sort: 'date',
    ...routerProps,
  };

  it('can set a search as default', async () => {
    const mockPinSearch = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/pinned-searches/',
      method: 'PUT',
      body: TestStubs.Search({
        isPinned: true,
        visibility: SavedSearchVisibility.OwnerPinned,
      }),
    });

    render(<IssueListSetAsDefault {...defaultProps} />);

    userEvent.click(screen.getByRole('button', {name: /set as default/i}));

    await waitFor(() => {
      expect(mockPinSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {query: 'is:unresolved', sort: 'date', type: SavedSearchType.ISSUE},
        })
      );
    });
  });

  it('can remove a default search', async () => {
    const mockUnpinSearch = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/pinned-searches/',
      method: 'DELETE',
    });

    render(
      <IssueListSetAsDefault
        {...defaultProps}
        savedSearch={TestStubs.Search({isPinned: true})}
      />
    );

    userEvent.click(screen.getByRole('button', {name: /remove default/i}));

    await waitFor(() => {
      expect(mockUnpinSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {type: SavedSearchType.ISSUE},
        })
      );
    });
  });
});
