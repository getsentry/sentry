import SavedSearchesStore from 'app/stores/savedSearchesStore';
import {
  fetchSavedSearches,
  pinSearch,
  unpinSearch,
} from 'app/actionCreators/savedSearches';
import {Client} from 'app/api';

describe('SavedSearchesStore', function() {
  let api;

  beforeAll(function() {
    api = new Client();
  });

  beforeEach(function() {
    Client.addMockResponse({
      url: '/organizations/org-1/searches/',
      body: TestStubs.Searches(),
    });
    Client.addMockResponse({
      url: '/organizations/org-1/pinned-searches/',
      method: 'PUT',
    });
    Client.addMockResponse({
      url: '/organizations/org-1/pinned-searches/',
      method: 'DELETE',
    });
  });

  afterEach(function() {
    Client.clearMockResponses();
    SavedSearchesStore.reset();
  });

  it('get', function() {
    expect(SavedSearchesStore.get()).toEqual({
      hasError: false,
      isLoading: true,
      savedSearches: [],
    });
  });

  it('fetching saved searches updates store', async function() {
    await fetchSavedSearches(api, 'org-1', {});
    await tick();

    expect(SavedSearchesStore.get().savedSearches).toHaveLength(2);
    expect(SavedSearchesStore.get().isLoading).toBe(false);
  });

  it('creates a new pin search', async function() {
    await fetchSavedSearches(api, 'org-1', {});
    await tick();

    pinSearch(api, 'org-1', 0, 'level:info');
    await tick();

    expect(SavedSearchesStore.get().savedSearches).toHaveLength(3);
    expect(SavedSearchesStore.get().savedSearches[0]).toEqual(
      expect.objectContaining({
        id: null,
        isPinned: true,
        type: 0,
        query: 'level:info',
        name: 'My Pinned Search',
      })
    );
  });

  it('changes pinned search from a custom search to an existing search', async function() {
    const searches = TestStubs.Searches();

    Client.addMockResponse({
      url: '/organizations/org-1/searches/',
      body: [
        {
          id: null,
          isPinned: true,
          type: 0,
          query: 'assigned:me',
        },
        ...searches,
      ],
    });
    await fetchSavedSearches(api, 'org-1', {});
    await tick();

    pinSearch(api, 'org-1', 0, searches[1].query);
    await tick();

    // Order should remain the same
    expect(SavedSearchesStore.get().savedSearches[1]).toEqual(
      expect.objectContaining({
        id: '1',
        isPinned: true,
        type: 0,
        name: 'Unresolved Issues',
        query: 'is:unresolved',
      })
    );

    // Saved custom search should be removed
    expect(SavedSearchesStore.get().savedSearches).toHaveLength(2);
  });

  it('changes pinned search from an existing search to another existing search', async function() {
    const searches = TestStubs.Searches();

    Client.addMockResponse({
      url: '/organizations/org-1/searches/',
      body: [{...searches[0], isPinned: true}, searches[1]],
    });
    await fetchSavedSearches(api, 'org-1', {});
    await tick();

    pinSearch(api, 'org-1', 0, searches[1].query);
    await tick();

    expect(SavedSearchesStore.get().savedSearches).toHaveLength(2);

    expect(SavedSearchesStore.get().savedSearches[0]).toEqual(
      expect.objectContaining({
        id: '2',
        isPinned: false,
        type: 0,
        name: 'Needs Triage',
        query: 'is:unresolved is:unassigned',
      })
    );

    expect(SavedSearchesStore.get().savedSearches[1]).toEqual(
      expect.objectContaining({
        id: '1',
        isPinned: true,
        type: 0,
        name: 'Unresolved Issues',
        query: 'is:unresolved',
      })
    );
  });

  it('unpins a user custom search (not global, and not org custom)', async function() {
    const searches = TestStubs.Searches();

    Client.addMockResponse({
      url: '/organizations/org-1/searches/',
      body: [
        {
          id: null,
          isPinned: true,
          type: 0,
          query: 'assigned:me',
        },
        ...searches,
      ],
    });
    await fetchSavedSearches(api, 'org-1', {});
    await tick();

    unpinSearch(api, 'org-1', 0, searches[0]);
    await tick();

    // Saved custom search should be removed
    expect(SavedSearchesStore.get().savedSearches).toHaveLength(2);

    expect(SavedSearchesStore.get().savedSearches[0]).toEqual(
      expect.objectContaining({
        id: '2',
        isPinned: false,
        type: 0,
        name: 'Needs Triage',
        query: 'is:unresolved is:unassigned',
      })
    );

    expect(SavedSearchesStore.get().savedSearches[1]).toEqual(
      expect.objectContaining({
        id: '1',
        isPinned: false,
        type: 0,
        name: 'Unresolved Issues',
        query: 'is:unresolved',
      })
    );
  });

  it('unpins an existing global saved search', async function() {
    const searches = TestStubs.Searches();

    Client.addMockResponse({
      url: '/organizations/org-1/searches/',
      body: [{...searches[0], isPinned: true}, searches[1]],
    });
    await fetchSavedSearches(api, 'org-1', {});
    await tick();

    unpinSearch(api, 'org-1', 0, searches[0]);
    await tick();

    expect(SavedSearchesStore.get().savedSearches).toHaveLength(2);

    expect(SavedSearchesStore.get().savedSearches[0]).toEqual(
      expect.objectContaining({
        id: '2',
        isPinned: false,
        type: 0,
        name: 'Needs Triage',
        query: 'is:unresolved is:unassigned',
      })
    );

    expect(SavedSearchesStore.get().savedSearches[1]).toEqual(
      expect.objectContaining({
        id: '1',
        isPinned: false,
        type: 0,
        name: 'Unresolved Issues',
        query: 'is:unresolved',
      })
    );
  });

  it('unpins an existing org saved search', async function() {
    const searches = TestStubs.Searches();

    Client.addMockResponse({
      url: '/organizations/org-1/searches/',
      body: [
        {...searches[0], isOrgCustom: true, isGlobal: false, isPinned: true},
        searches[1],
      ],
    });
    await fetchSavedSearches(api, 'org-1', {});
    await tick();

    unpinSearch(api, 'org-1', 0, searches[0]);
    await tick();

    expect(SavedSearchesStore.get().savedSearches).toHaveLength(2);

    expect(SavedSearchesStore.get().savedSearches[0]).toEqual(
      expect.objectContaining({
        id: '2',
        isPinned: false,
        type: 0,
        name: 'Needs Triage',
        query: 'is:unresolved is:unassigned',
      })
    );

    expect(SavedSearchesStore.get().savedSearches[1]).toEqual(
      expect.objectContaining({
        id: '1',
        isPinned: false,
        type: 0,
        name: 'Unresolved Issues',
        query: 'is:unresolved',
      })
    );
  });
});
