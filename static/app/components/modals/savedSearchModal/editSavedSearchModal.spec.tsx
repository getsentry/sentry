import selectEvent from 'react-select-event';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {EditSavedSearchModal} from 'sentry/components/modals/savedSearchModal/editSavedSearchModal';
import {SavedSearchType, SavedSearchVisibility} from 'sentry/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('EditSavedSearchModal', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
  });

  const defaultProps = {
    Body: ModalBody,
    Header: makeClosableHeader(jest.fn()),
    Footer: ModalFooter,
    CloseButton: makeCloseButton(jest.fn()),
    closeModal: jest.fn(),
    organization: Organization(),
    savedSearch: {
      id: 'saved-search-id',
      name: 'Saved search name',
      query: 'is:unresolved browser:firefox',
      sort: IssueSortOptions.DATE,
      visibility: SavedSearchVisibility.OWNER,
      dateCreated: '',
      isPinned: false,
      isGlobal: false,
      type: SavedSearchType.ISSUE,
    },
  };

  it('can edit a saved search with org:write', async function () {
    const editMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/saved-search-id/',
      method: 'PUT',
      body: {
        id: 'saved-search-id',
        name: 'test',
        query: 'is:unresolved browser:firefox',
        sort: IssueSortOptions.PRIORITY,
        visibility: SavedSearchVisibility.OWNER,
      },
    });

    render(<EditSavedSearchModal {...defaultProps} />);

    await userEvent.clear(screen.getByRole('textbox', {name: /name/i}));
    await userEvent.paste('new search name');

    await userEvent.clear(screen.getByRole('textbox', {name: /filter issues/i}));
    await userEvent.paste('test');

    await selectEvent.select(screen.getByText('Last Seen'), 'Priority');

    await selectEvent.select(screen.getByText('Only me'), 'Users in my organization');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(editMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/saved-search-id/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new search name',
            query: 'test',
            visibility: SavedSearchVisibility.ORGANIZATION,
          }),
        })
      );
    });
  });

  it('can edit a saved search without org:write', async function () {
    const editMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/saved-search-id/',
      method: 'PUT',
      body: {
        id: 'saved-search-id',
        name: 'test',
        query: 'is:unresolved browser:firefox',
        sort: IssueSortOptions.PRIORITY,
        visibility: SavedSearchVisibility.OWNER,
      },
    });

    render(
      <EditSavedSearchModal
        {...defaultProps}
        organization={Organization({
          access: [],
        })}
      />
    );

    await userEvent.clear(screen.getByRole('textbox', {name: /name/i}));
    await userEvent.paste('new search name');

    await userEvent.clear(screen.getByTestId('smart-search-input'));
    await userEvent.paste('test');

    await selectEvent.select(screen.getByText('Last Seen'), 'Priority');

    // Hovering over the visibility dropdown shows disabled reason
    await userEvent.hover(screen.getByText(/only me/i));
    await screen.findByText(/only organization admins can create global saved searches/i);

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(editMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/saved-search-id/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new search name',
            query: 'test',
            visibility: SavedSearchVisibility.OWNER,
          }),
        })
      );
    });
  });
});
