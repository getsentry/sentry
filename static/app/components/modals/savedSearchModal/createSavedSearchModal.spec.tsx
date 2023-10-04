import selectEvent from 'react-select-event';
import {Organization} from 'sentry-fixture/organization';

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
  const organization = Organization({
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

    await userEvent.click(screen.getByRole('textbox', {name: /name/i}));
    await userEvent.paste('new search name');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'new search name',
            query: 'is:unresolved assigned:lyn@sentry.io',
            sort: IssueSortOptions.DATE,
            type: 0,
            visibility: SavedSearchVisibility.OWNER,
          },
        })
      );
    });
  });

  it('saves a search when query is changed', async function () {
    render(<CreateSavedSearchModal {...defaultProps} />);

    await userEvent.click(screen.getByRole('textbox', {name: /name/i}));
    await userEvent.paste('new search name');

    await userEvent.clear(screen.getByRole('textbox', {name: /filter issues/i}));
    await userEvent.click(screen.getByRole('textbox', {name: /filter issues/i}));
    await userEvent.paste('is:resolved');

    await selectEvent.select(screen.getByText('Last Seen'), 'Priority');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/',
        expect.objectContaining({
          data: {
            name: 'new search name',
            query: 'is:resolved',
            sort: IssueSortOptions.PRIORITY,
            type: 0,
            visibility: SavedSearchVisibility.OWNER,
          },
        })
      );
    });
  });

  describe('visibility', () => {
    it('only allows owner-level visibility without org:write permission', async function () {
      const org = Organization({
        access: [],
      });

      render(<CreateSavedSearchModal {...defaultProps} organization={org} />);

      await userEvent.click(screen.getByRole('textbox', {name: /name/i}));
      await userEvent.paste('new search name');

      // Hovering over the visibility dropdown shows disabled reason
      await userEvent.hover(screen.getByText(/only me/i));
      await screen.findByText(
        /only organization admins can create global saved searches/i
      );

      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(createMock).toHaveBeenCalledWith(
          '/organizations/org-slug/searches/',
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'new search name',
              visibility: SavedSearchVisibility.OWNER,
            }),
          })
        );
      });
    });
  });

  it('can change to org-level visibility with org:write permission', async function () {
    const org = Organization({
      access: ['org:write'],
    });
    render(<CreateSavedSearchModal {...defaultProps} organization={org} />);
    await userEvent.click(screen.getByRole('textbox', {name: /name/i}));
    await userEvent.paste('new search name');
    await selectEvent.select(screen.getByText('Only me'), 'Users in my organization');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new search name',
            visibility: SavedSearchVisibility.ORGANIZATION,
          }),
        })
      );
    });
  });
});
