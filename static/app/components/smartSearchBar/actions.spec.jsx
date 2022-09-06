import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {makePinSearchAction} from 'sentry/components/smartSearchBar/actions';

describe('SmartSearchBar', () => {
  describe('actions', function () {
    const organization = TestStubs.Organization({id: '123'});
    const api = new MockApiClient();

    let pinRequest, unpinRequest, location;

    beforeEach(function () {
      location = {
        pathname: `/organizations/${organization.slug}/recent-searches/`,
        query: {
          projectId: '0',
        },
      };

      pinRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/pinned-searches/`,
        method: 'PUT',
        body: [],
      });
      unpinRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/pinned-searches/`,
        method: 'DELETE',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/recent-searches/`,
        method: 'POST',
        body: {},
      });
    });

    it('does not pin when query is empty', function () {
      const {Action} = makePinSearchAction({sort: ''});

      render(
        <Action
          api={api}
          organization={organization}
          query=""
          savedSearchType={0}
          location={location}
        />
      );

      userEvent.click(screen.getByRole('button'));

      expect(pinRequest).not.toHaveBeenCalled();
    });

    it('adds pins', function () {
      const {Action} = makePinSearchAction({sort: ''});

      render(
        <Action
          api={api}
          organization={organization}
          query="is:unresolved"
          savedSearchType={0}
          location={location}
        />
      );

      userEvent.click(screen.getByRole('button'));

      expect(pinRequest).toHaveBeenCalled();
      expect(unpinRequest).not.toHaveBeenCalled();
    });

    it('removes pins', function () {
      const pinnedSearch = TestStubs.Search({isPinned: true});
      const {Action} = makePinSearchAction({pinnedSearch, sort: ''});

      render(
        <Action
          api={api}
          organization={organization}
          query="is:unresolved"
          savedSearchType={0}
          location={location}
        />
      );

      userEvent.click(screen.getByRole('button'));

      expect(pinRequest).not.toHaveBeenCalled();
      expect(unpinRequest).toHaveBeenCalled();
    });
  });
});
