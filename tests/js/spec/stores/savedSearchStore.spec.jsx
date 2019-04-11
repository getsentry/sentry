import SavedSearchStore from 'app/stores/savedSearchStore';
import {fetchSavedSearches} from 'app/actionCreators/savedSearches';
import {Client} from 'app/api';

describe('SavedSearchStore', function() {
  beforeEach(function() {
    Client.addMockResponse({
      url: '/organizations/org-1/searches/',
      body: TestStubs.Searches(),
    });
  });

  afterEach(function() {
    Client.clearMockResponses();
  });

  it('get', function() {
    expect(SavedSearchStore.get()).toEqual({isLoading: true, savedSearches: []});
  });

  it('fetching saved searches updates store', async function() {
    const api = new Client();
    fetchSavedSearches(api, 'org-1');
    await tick();
    expect(SavedSearchStore.get().savedSearches).toHaveLength(2);
    expect(SavedSearchStore.get().isLoading).toBe(false);
  });
});
