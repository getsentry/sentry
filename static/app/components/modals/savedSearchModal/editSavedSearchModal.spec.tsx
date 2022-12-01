import selectEvent from 'react-select-event';

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
    organization: TestStubs.Organization({features: ['issue-list-saved-searches-v2']}),
    savedSearch: {
      id: 'saved-search-id',
      name: 'Saved search name',
      query: 'is:unresolved browser:firefox',
      sort: IssueSortOptions.DATE,
      visibility: SavedSearchVisibility.Owner,
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
        visibility: SavedSearchVisibility.Owner,
      },
    });

    render(<EditSavedSearchModal {...defaultProps} />);

    userEvent.clear(screen.getByRole('textbox', {name: /name/i}));
    userEvent.type(screen.getByRole('textbox', {name: /name/i}), 'new search name');

    userEvent.clear(screen.getByRole('textbox', {name: /filter issues/i}));
    userEvent.type(screen.getByRole('textbox', {name: /filter issues/i}), 'test');

    await selectEvent.select(screen.getByText('Last Seen'), 'Priority');

    await selectEvent.select(screen.getByText('Only me'), 'Users in my organization');

    userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(editMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/saved-search-id/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new search name',
            query: 'test',
            visibility: SavedSearchVisibility.Organization,
          }),
        })
      );
    });
  });

  it('can edit a saved search without org:write', async function () {
    jest.useFakeTimers();

    const editMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/saved-search-id/',
      method: 'PUT',
      body: {
        id: 'saved-search-id',
        name: 'test',
        query: 'is:unresolved browser:firefox',
        sort: IssueSortOptions.PRIORITY,
        visibility: SavedSearchVisibility.Owner,
      },
    });

    render(
      <EditSavedSearchModal
        {...defaultProps}
        organization={TestStubs.Organization({
          access: [],
          features: ['issue-list-saved-searches-v2'],
        })}
      />
    );

    userEvent.clear(screen.getByRole('textbox', {name: /name/i}));
    userEvent.type(screen.getByRole('textbox', {name: /name/i}), 'new search name');

    userEvent.clear(screen.getByTestId('smart-search-input'));
    userEvent.type(screen.getByTestId('smart-search-input'), 'test');

    await selectEvent.select(screen.getByText('Last Seen'), 'Priority');

    // Hovering over the visibility dropdown shows disabled reason
    userEvent.hover(screen.getByText(/only me/i));
    await screen.findByText(/only organization admins can create global saved searches/i);

    userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(editMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/saved-search-id/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new search name',
            query: 'test',
            visibility: SavedSearchVisibility.Owner,
          }),
        })
      );
    });
  });
});
