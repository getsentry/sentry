import selectEvent from 'react-select-event';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {CreateSavedSearchModal} from 'sentry/components/modals/savedSearchModal/createSavedSearchModal';
import {SavedSearchVisibility} from 'sentry/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('CreateSavedSearchModal', function () {
  let createMock;
  const organization = TestStubs.Organization({
    access: ['org:write'],
  });

  const defaultProps = {
    Body: ModalBody,
    Header: makeClosableHeader(jest.fn()),
    Footer: ModalFooter,
    CloseButton: makeCloseButton(jest.fn()),
    closeModal: jest.fn(),
    organization,
    query: 'is:unresolved assigned:lyn@sentry.io',
    sort: IssueSortOptions.DATE,
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      method: 'POST',
      body: {id: '1', name: 'test', query: 'is:unresolved assigned:lyn@sentry.io'},
    });
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

  it('saves a search when query is not changed', async function () {
    render(<CreateSavedSearchModal {...defaultProps} />);

    userEvent.type(screen.getByRole('textbox', {name: /name/i}), 'new search name');

    userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'new search name',
            query: 'is:unresolved assigned:lyn@sentry.io',
            sort: IssueSortOptions.DATE,
            type: 0,
            visibility: SavedSearchVisibility.Organization,
          },
        })
      );
    });
  });

  it('saves a search when query is changed', async function () {
    render(<CreateSavedSearchModal {...defaultProps} />);

    userEvent.type(screen.getByRole('textbox', {name: /name/i}), 'new search name');
    userEvent.clear(screen.getByRole('textbox', {name: /filter issues/i}));
    userEvent.type(
      screen.getByRole('textbox', {name: /filter issues/i}),
      'is:resolved{enter}'
    );
    await selectEvent.select(screen.getByText('Last Seen'), 'Priority');
    userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/',
        expect.objectContaining({
          data: {
            name: 'new search name',
            query: 'is:resolved',
            sort: IssueSortOptions.PRIORITY,
            type: 0,
            visibility: SavedSearchVisibility.Organization,
          },
        })
      );
    });
  });

  describe('visibility', () => {
    it('only allows owner-level visibility without org:write permission', async function () {
      const org = TestStubs.Organization({
        features: ['issue-list-saved-searches-v2'],
        access: [],
      });

      render(<CreateSavedSearchModal {...defaultProps} organization={org} />);

      userEvent.type(screen.getByRole('textbox', {name: /name/i}), 'new search name');

      // Hovering over the visibility dropdown shows disabled reason
      userEvent.hover(screen.getByText(/only me/i));
      await screen.findByText(
        /only organization admins can create global saved searches/i
      );

      userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(createMock).toHaveBeenCalledWith(
          '/organizations/org-slug/searches/',
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'new search name',
              visibility: SavedSearchVisibility.Owner,
            }),
          })
        );
      });
    });
  });

  it('can change to org-level visibility with org:write permission', async function () {
    const org = TestStubs.Organization({
      features: ['issue-list-saved-searches-v2'],
      access: ['org:write'],
    });
    render(<CreateSavedSearchModal {...defaultProps} organization={org} />);
    userEvent.type(screen.getByRole('textbox', {name: /name/i}), 'new search name');
    await selectEvent.select(screen.getByText('Only me'), 'Users in my organization');
    userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new search name',
            visibility: SavedSearchVisibility.Organization,
          }),
        })
      );
    });
  });
});
