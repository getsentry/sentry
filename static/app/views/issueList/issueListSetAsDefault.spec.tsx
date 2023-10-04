import {Organization} from 'sentry-fixture/organization';
import {Search} from 'sentry-fixture/search';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SavedSearchType, SavedSearchVisibility} from 'sentry/types';
import IssueListSetAsDefault from 'sentry/views/issueList/issueListSetAsDefault';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('IssueListSetAsDefault', () => {
  const organization = Organization();

  const {router} = initializeOrg();

  const routerProps = {
    params: router.params,
    location: router.location,
  };

  const defaultProps = {
    organization,
    query: 'browser:firefox',
    sort: IssueSortOptions.DATE,
    ...routerProps,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('can set a search as default', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [],
    });
    const mockPinSearch = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/pinned-searches/',
      method: 'PUT',
      body: Search({
        isPinned: true,
        visibility: SavedSearchVisibility.OWNER_PINNED,
      }),
    });

    render(<IssueListSetAsDefault {...defaultProps} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: /set as default/i}));

    await waitFor(() => {
      expect(mockPinSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {query: 'browser:firefox', sort: 'date', type: SavedSearchType.ISSUE},
        })
      );
    });
  });

  it('can remove a default search', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [Search({isPinned: true, query: 'browser:firefox'})],
    });
    const mockUnpinSearch = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/pinned-searches/',
      method: 'DELETE',
    });

    render(<IssueListSetAsDefault {...defaultProps} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: /remove default/i}));

    await waitFor(() => {
      expect(mockUnpinSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {type: SavedSearchType.ISSUE},
        })
      );
    });
  });

  it('does not render anything when on default search and no pinned search', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [Search({isPinned: false, query: 'browser:firefox'})],
    });

    render(<IssueListSetAsDefault {...defaultProps} query="is:unresolved" />, {
      organization,
    });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does render when on default search and existing pinned search', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [Search({isPinned: true, query: 'browser:firefox'})],
    });

    render(<IssueListSetAsDefault {...defaultProps} query="is:unresolved" />, {
      organization,
    });

    await screen.findByRole('button', {name: /remove default/i});
  });
});
