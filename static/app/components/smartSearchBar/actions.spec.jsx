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
      const {makeAction} = makePinSearchAction({sort: '', location});

      const Action = makeAction({
        api,
        organization,
        query: '',
        savedSearchType: 0,
      }).Button;

      render(<Action />);

      userEvent.click(screen.getByRole('button'));

      expect(pinRequest).not.toHaveBeenCalled();
    });

    it('adds pins', function () {
      const {makeAction} = makePinSearchAction({sort: '', location});

      const Action = makeAction({
        api,
        organization,
        query: 'is:unresolved',
        savedSearchType: 0,
      }).Button;

      render(<Action />);

      userEvent.click(screen.getByRole('button'));

      expect(pinRequest).toHaveBeenCalled();
      expect(unpinRequest).not.toHaveBeenCalled();
    });

    it('removes pins', function () {
      const pinnedSearch = TestStubs.Search({isPinned: true});
      const {makeAction} = makePinSearchAction({pinnedSearch, sort: '', location});

      const Action = makeAction({
        api,
        organization,
        query: 'is:unresolved',
        savedSearchType: 0,
      }).Button;

      render(<Action />);

      userEvent.click(screen.getByRole('button'));

      expect(pinRequest).not.toHaveBeenCalled();
      expect(unpinRequest).toHaveBeenCalled();
    });
  });
});
