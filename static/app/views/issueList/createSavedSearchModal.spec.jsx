import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CreateSavedSearchModal from 'sentry/views/issueList/createSavedSearchModal';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('CreateSavedSearchModal', function () {
  let createMock;
  const organization = TestStubs.Organization({
    access: ['org:write'],
  });

  function renderComponent() {
    return render(
      <CreateSavedSearchModal
        Header={p => p.children}
        Body={p => p.children}
        Footer={p => p.children}
        organization={organization}
        query="is:unresolved assigned:lyn@sentry.io"
        sort={IssueSortOptions.DATE}
      />
    );
  }

  beforeEach(function () {
    createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      method: 'POST',
      body: {id: '1', name: 'test', query: 'is:unresolved assigned:lyn@sentry.io'},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('saves a search when query is not changed', function () {
    renderComponent();
    userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'new search name');
    userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          name: 'new search name',
          query: 'is:unresolved assigned:lyn@sentry.io',
          sort: IssueSortOptions.DATE,
          type: 0,
        },
      })
    );
  });

  it('saves a search when query is changed', async function () {
    renderComponent();
    userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'new search name');
    userEvent.clear(screen.getByRole('textbox', {name: 'Query'}));
    userEvent.type(screen.getByRole('textbox', {name: 'Query'}), 'is:resolved');
    await selectEvent.select(screen.getByText('Last Seen'), 'Priority');
    userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(createMock).toHaveBeenCalledWith(
      '/organizations/org-slug/searches/',
      expect.objectContaining({
        data: {
          name: 'new search name',
          query: 'is:resolved',
          sort: IssueSortOptions.PRIORITY,
          type: 0,
        },
      })
    );
  });
});
