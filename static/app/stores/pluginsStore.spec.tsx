import {Plugin} from 'sentry-fixture/plugin';
import {Plugins} from 'sentry-fixture/plugins';

import PluginsStore from 'sentry/stores/pluginsStore';

describe('PluginsStore', function () {
  beforeEach(function () {
    jest.resetAllMocks();
  });

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
      const triggerSpy = jest.spyOn(PluginsStore, 'trigger');
      PluginsStore.onFetchAll();
      expect(triggerSpy).toHaveBeenCalledWith({
        loading: true,
        error: null,
        pageLinks: null,
        plugins: [],
      });

      PluginsStore.onFetchAllSuccess(Plugins(), {pageLinks: undefined});

      expect(triggerSpy).toHaveBeenCalledWith({
        loading: false,
        error: null,
        pageLinks: null,
        plugins: Plugins(),
      });
    });

    it('has correct state when error in fetching all plugins', function () {
      const triggerSpy = jest.spyOn(PluginsStore, 'trigger');
      PluginsStore.onFetchAll();

      expect(triggerSpy).toHaveBeenCalledWith({
        loading: true,
        error: null,
        pageLinks: null,
        plugins: [],
      });

      PluginsStore.onFetchAllError({responseJSON: {message: 'Error'}});

      expect(triggerSpy).toHaveBeenCalledWith({
        loading: false,
        error: {responseJSON: {message: 'Error'}},
        pageLinks: null,
        plugins: [],
      });
    });

    it('does not reset loading state on consecutive fetches', function () {
      const triggerSpy = jest.spyOn(PluginsStore, 'trigger');
      PluginsStore.onFetchAll();
      expect(triggerSpy).toHaveBeenCalledWith({
        loading: true,
        error: null,
        pageLinks: null,
        plugins: [],
      });

      PluginsStore.onFetchAllSuccess(Plugins(), {pageLinks: undefined});

      expect(triggerSpy).toHaveBeenCalledWith({
        loading: false,
        error: null,
        pageLinks: null,
        plugins: Plugins(),
      });

      PluginsStore.onFetchAll();
      expect(triggerSpy).toHaveBeenCalledWith({
        loading: false,
        error: null,
        pageLinks: null,
        plugins: Plugins(),
      });
    });
  });

  describe('update', function () {
    const plugin = Plugin();
    beforeEach(function () {
      PluginsStore.reset();
      PluginsStore.plugins = new Map(Plugins().map(p => [p.id, p]));
    });

    it('has optimistic state when updating', function () {
      PluginsStore.onUpdate('amazon-sqs', {name: 'Amazon Sqs'});

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
      PluginsStore.onUpdate('amazon-sqs', {name: 'Amazon Sqs'});

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
      PluginsStore.onUpdate('amazon-sqs', {name: 'Amazon Sqs'});

      expect(PluginsStore.updating.get('amazon-sqs')).toMatchObject({
        ...plugin,
        id: 'amazon-sqs',
        name: 'Amazon SQS',
      });

      PluginsStore.onUpdateSuccess('amazon-sqs');

      expect(PluginsStore.getState().plugins[0]).toMatchObject({
        id: 'amazon-sqs',
        name: 'Amazon Sqs',
      });

      expect(PluginsStore.updating.get('amazon-sqs')).toEqual(undefined);
    });

    it('restores old plugin state when update has an error', function () {
      PluginsStore.onUpdate('amazon-sqs', {name: 'Amazon Sqs'});

      expect(PluginsStore.getState().plugins[0]).toMatchObject({
        id: 'amazon-sqs',
        name: 'Amazon Sqs',
      });

      PluginsStore.onUpdateError('amazon-sqs', new Error('error'));

      expect(PluginsStore.getState().plugins[0]).toMatchObject({
        id: 'amazon-sqs',
        name: 'Amazon SQS',
      });
      expect(PluginsStore.updating.get('amazon-sqs')).toEqual(undefined);
    });
  });
});
