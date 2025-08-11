import AlertStore from 'sentry/stores/alertStore';

jest.mock('sentry/utils/localStorage');

describe('AlertStore', function () {
  beforeEach(function () {
    AlertStore.init();
  });

  describe('addAlert()', function () {
    it('should add a new alert with incrementing key', function () {
      AlertStore.addAlert({
        message: 'Bzzzzzzp *crash*',
        type: 'error',
      });

      AlertStore.addAlert({
        message: 'Everything is super',
        type: 'info',
      });

      expect(AlertStore.getState()).toHaveLength(2);
      expect(AlertStore.getState()[0]!.key).toBe(0);
      expect(AlertStore.getState()[1]!.key).toBe(1);
    });

    it('should not add duplicates when noDuplicates is set', function () {
      AlertStore.addAlert({
        id: 'unique-key',
        message: 'Bzzzzzzp *crash*',
        type: 'error',
        noDuplicates: true,
      });
      AlertStore.addAlert({
        id: 'unique-key',
        message: 'Bzzzzzzp *crash*',
        type: 'error',
        noDuplicates: true,
      });

      expect(AlertStore.getState()).toHaveLength(1);
    });
  });

  describe('closeAlert()', function () {
    it('should remove alert', function () {
      const alerts = [
        {message: 'foo', type: 'error'},
        {message: 'bar', type: 'error'},
        {message: 'baz', type: 'error'},
      ] as const;
      for (const alert of alerts) {
        AlertStore.addAlert(alert);
      }

      expect(AlertStore.getState()).toHaveLength(3);
      AlertStore.closeAlert(AlertStore.getState()[1]!);

      const newState = AlertStore.getState();
      expect(newState).toHaveLength(2);
      expect(newState).toEqual([alerts[0], alerts[2]]);
    });
    it('should persist removal of persistent alerts', function () {
      const alert = {
        key: 1,
        id: 'test',
        message: 'this is a test',
        type: 'error',
      } as const;

      AlertStore.closeAlert(alert);
      AlertStore.addAlert(alert);
      expect(AlertStore.getState()).toHaveLength(0);
    });
  });

  it('returns a stable reference from getState', () => {
    AlertStore.addAlert({
      message: 'Bzzzzzzp *crash*',
      type: 'error',
    });

    const state = AlertStore.getState();
    expect(Object.is(state, AlertStore.getState())).toBe(true);
  });
});
