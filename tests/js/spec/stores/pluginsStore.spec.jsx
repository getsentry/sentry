import PluginsStore from 'app/stores/pluginsStore';
import PluginActions from 'app/actions/pluginActions';

describe('PluginsStore', function () {
  beforeAll(function () {
    jest.spyOn(PluginsStore, 'trigger');
  });
  beforeEach(function () {
    PluginsStore.trigger.mockReset();
  });

  afterEach(function () {});

  it('has correct initial state', function () {
    PluginsStore.reset();
    expect(PluginsStore.getState()).toEqual({
      loading: true,
      error: null,
      pageLinks: null,
      plugins: [],
    });
  });

  describe('fetchAll', function () {
    beforeEach(function () {
      PluginsStore.reset();
    });

    it('has correct state when all plugins fetched successfully', function () {
      PluginActions.fetchAll.trigger();
      expect(PluginsStore.trigger).toHaveBeenCalledWith({
        loading: true,
        error: null,
        pageLinks: null,
        plugins: [],
      });

      PluginActions.fetchAllSuccess.trigger(TestStubs.Plugins(), {pageLinks: null});

      expect(PluginsStore.trigger).toHaveBeenCalledWith({
        loading: false,
        error: null,
        pageLinks: null,
        plugins: TestStubs.Plugins(),
      });
    });

    it('has correct state when error in fetching all plugins', function () {
      PluginActions.fetchAll.trigger();

      expect(PluginsStore.trigger).toHaveBeenCalledWith({
        loading: true,
        error: null,
        pageLinks: null,
        plugins: [],
      });

      PluginActions.fetchAllError.trigger({responseJSON: {message: 'Error'}});

      expect(PluginsStore.trigger).toHaveBeenCalledWith({
        loading: false,
        error: {responseJSON: {message: 'Error'}},
        pageLinks: null,
        plugins: [],
      });
    });

    it('does not reset loading state on consecutive fetches', function () {
      PluginActions.fetchAll.trigger();
      expect(PluginsStore.trigger).toHaveBeenCalledWith({
        loading: true,
        error: null,
        pageLinks: null,
        plugins: [],
      });

      PluginActions.fetchAllSuccess.trigger(TestStubs.Plugins(), {pageLinks: null});

      expect(PluginsStore.trigger).toHaveBeenCalledWith({
        loading: false,
        error: null,
        pageLinks: null,
        plugins: TestStubs.Plugins(),
      });

      PluginActions.fetchAll.trigger();
      expect(PluginsStore.trigger).toHaveBeenCalledWith({
        loading: false,
        error: null,
        pageLinks: null,
        plugins: TestStubs.Plugins(),
      });
    });
  });

  describe('update', function () {
    const plugin = TestStubs.Plugin();
    beforeEach(function () {
      PluginsStore.reset();
      PluginsStore.plugins = new Map(TestStubs.Plugins().map(p => [p.id, p]));
    });

    it('has optimistic state when updating', function () {
      PluginActions.update.trigger('amazon-sqs', {name: 'Amazon Sqs'});

      const state = PluginsStore.getState();
      expect(state).toMatchObject({
        error: null,
        pageLinks: null,
      });

      expect(state.plugins[0]).toMatchObject({
        ...plugin,
        id: 'amazon-sqs',
        name: 'Amazon Sqs',
      });

      // Doesn't update other plugins plz
      expect(state.plugins[1]).toMatchObject({
        id: 'github',
        name: 'GitHub',
      });
    });

    it('saves old plugin state', function () {
      PluginActions.update.trigger('amazon-sqs', {name: 'Amazon Sqs'});

      const state = PluginsStore.getState();
      expect(state).toMatchObject({
        error: null,
        pageLinks: null,
      });

      expect(PluginsStore.updating.get('amazon-sqs')).toMatchObject({
        ...plugin,
        id: 'amazon-sqs',
        name: 'Amazon SQS',
      });
    });

    it('removes old plugin state on successful update', function () {
      PluginActions.update.trigger('amazon-sqs', {name: 'Amazon Sqs'});

      expect(PluginsStore.updating.get('amazon-sqs')).toMatchObject({
        ...plugin,
        id: 'amazon-sqs',
        name: 'Amazon SQS',
      });

      PluginActions.updateSuccess.trigger('amazon-sqs');

      expect(PluginsStore.getState().plugins[0]).toMatchObject({
        id: 'amazon-sqs',
        name: 'Amazon Sqs',
      });

      expect(PluginsStore.updating.get('amazon-sqs')).toEqual(undefined);
    });

    it('restores old plugin state when update has an error', function () {
      PluginActions.update.trigger('amazon-sqs', {name: 'Amazon Sqs'});

      expect(PluginsStore.getState().plugins[0]).toMatchObject({
        id: 'amazon-sqs',
        name: 'Amazon Sqs',
      });

      PluginActions.updateError.trigger('amazon-sqs');

      expect(PluginsStore.getState().plugins[0]).toMatchObject({
        id: 'amazon-sqs',
        name: 'Amazon SQS',
      });
      expect(PluginsStore.updating.get('amazon-sqs')).toEqual(undefined);
    });
  });
});
