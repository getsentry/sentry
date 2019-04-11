import SavedSearchesStore from 'app/stores/savedSearchesStore';
import {fetchSavedSearches} from 'app/actionCreators/savedSearches';
import {Client} from 'app/api';

describe('SavedSearchesStore', function() {
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
    expect(SavedSearchesStore.get()).toEqual({isLoading: true, savedSearches: []});
  });

  it('fetching saved searches updates store', async function() {
    const api = new Client();
    fetchSavedSearches(api, 'org-1');
    await tick();
    expect(SavedSearchesStore.get().savedSearches).toHaveLength(2);
    expect(SavedSearchesStore.get().isLoading).toBe(false);
  });
});
