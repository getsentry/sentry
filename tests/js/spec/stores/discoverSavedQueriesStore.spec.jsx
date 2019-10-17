import DiscoverSavedQueriesStore from 'app/stores/discoverSavedQueriesStore';
import {
  fetchSavedQueries,
  createSavedQuery,
  updateSavedQuery,
  deleteSavedQuery,
} from 'app/actionCreators/discoverSavedQueries';
import {Client} from 'app/api';

describe('DiscoverSavedQueriesStore', function() {
  let api;
  const now = '2019-09-03T12:13:14';

  beforeAll(async function() {
    api = new Client();
    DiscoverSavedQueriesStore.reset();
    await tick();
  });

  beforeEach(function() {
    Client.addMockResponse({
      url: '/organizations/org-1/discover/saved/',
      body: [
        {
          id: '1',
          name: 'first query',
          fields: ['title', 'count()'],
          dateCreated: now,
          dateUpdated: now,
          createdBy: '1',
        },
        {
          id: '2',
          name: 'second query',
          fields: ['transaction', 'count()'],
          dateCreated: now,
          dateUpdated: now,
          createdBy: '1',
        },
      ],
    });
  });

  afterEach(async function() {
    Client.clearMockResponses();
    DiscoverSavedQueriesStore.reset();
    await tick();
  });

  it('has default state', function() {
    expect(DiscoverSavedQueriesStore.get()).toEqual({
      hasError: false,
      isLoading: true,
      savedQueries: [],
    });
  });

  it('fetching queries updates the store', async function() {
    fetchSavedQueries(api, 'org-1');
    await tick();
    await tick();

    const state = DiscoverSavedQueriesStore.get();
    expect(state.isLoading).toEqual(false);
    expect(state.hasError).toEqual(false);
    expect(state.savedQueries).toHaveLength(2);
  });

  it('fetching queries updates the store on error', async function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-1/discover/saved/',
      method: 'GET',
      statusCode: 500,
    });
    fetchSavedQueries(api, 'org-1');
    await tick();
    await tick();

    const state = DiscoverSavedQueriesStore.get();
    expect(state.isLoading).toEqual(false);
    expect(state.hasError).toEqual(true);
    expect(state.savedQueries).toHaveLength(0);
  });

  it('updating a query updates the store', async function() {
    Client.addMockResponse({
      url: '/organizations/org-1/discover/saved/2/',
      method: 'PUT',
      body: {
        id: '2',
        name: 'best query',
        fields: ['title', 'count()'],
        dateCreated: now,
        dateUpdated: now,
        createdBy: '2',
      },
    });
    fetchSavedQueries(api, 'org-1');
    await tick();
    await tick();

    const query = {
      id: '2',
      name: 'best query',
      fields: ['title', 'count()'],
    };
    updateSavedQuery(api, 'org-1', query);
    await tick();
    await tick();

    const state = DiscoverSavedQueriesStore.get();
    expect(state.isLoading).toEqual(false);
    expect(state.hasError).toEqual(false);
    expect(state.savedQueries).toHaveLength(2);
    expect(state.savedQueries[0].name).toEqual('first query');
    expect(state.savedQueries[1].name).toEqual('best query');
  });

  it('updating a query appends the store', async function() {
    Client.addMockResponse({
      url: '/organizations/org-1/discover/saved/9/',
      method: 'PUT',
      body: {
        id: '9',
        name: 'best query',
        fields: ['title', 'count()'],
        dateCreated: now,
        dateUpdated: now,
        createdBy: '2',
      },
    });
    fetchSavedQueries(api, 'org-1');
    await tick();
    await tick();

    const query = {
      id: '9',
      name: 'best query',
      fields: ['title', 'count()'],
    };
    updateSavedQuery(api, 'org-1', query);
    await tick();
    await tick();

    const state = DiscoverSavedQueriesStore.get();
    expect(state.isLoading).toEqual(false);
    expect(state.hasError).toEqual(false);
    expect(state.savedQueries).toHaveLength(3);
    expect(state.savedQueries[0].name).toEqual('first query');
    expect(state.savedQueries[1].name).toEqual('second query');
    expect(state.savedQueries[2].name).toEqual('best query');
  });

  it('creating a query updates the store', async function() {
    Client.addMockResponse({
      url: '/organizations/org-1/discover/saved/',
      method: 'POST',
      body: {
        id: '2',
        name: 'best query',
        fields: ['title', 'count()'],
        dateCreated: now,
        dateUpdated: now,
        createdBy: '2',
      },
    });

    fetchSavedQueries(api, 'org-1');
    await tick();

    const query = {
      name: 'best query',
      fields: ['title', 'count()'],
    };
    createSavedQuery(api, 'org-1', query);
    await tick();
    await tick();

    const state = DiscoverSavedQueriesStore.get();
    expect(state.isLoading).toEqual(false);
    expect(state.hasError).toEqual(false);
    expect(state.savedQueries).toHaveLength(3);
  });

  it('deleting a query updates the store', async function() {
    Client.addMockResponse({
      url: '/organizations/org-1/discover/saved/1/',
      method: 'DELETE',
      statusCode: 200,
    });

    fetchSavedQueries(api, 'org-1');
    await tick();

    deleteSavedQuery(api, 'org-1', '1');
    await tick();
    await tick();

    const state = DiscoverSavedQueriesStore.get();
    expect(state.isLoading).toEqual(false);
    expect(state.hasError).toEqual(false);
    expect(state.savedQueries).toHaveLength(1);
  });
});
