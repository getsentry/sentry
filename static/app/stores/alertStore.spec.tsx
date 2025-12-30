import AlertStore from 'sentry/stores/alertStore';

jest.mock('sentry/utils/localStorage');

describe('AlertStore', () => {
  beforeEach(() => {
    AlertStore.init();
  });

  describe('addAlert()', () => {
    it('should add a new alert with incrementing key', () => {
      AlertStore.addAlert({
        message: 'Bzzzzzzp *crash*',
        variant: 'danger',
      });

      AlertStore.addAlert({
        message: 'Everything is super',
        variant: 'info',
      });

      expect(AlertStore.getState()).toHaveLength(2);
      expect(AlertStore.getState()[0]!.key).toBe(0);
      expect(AlertStore.getState()[1]!.key).toBe(1);
    });

    it('should not add duplicates when noDuplicates is set', () => {
      AlertStore.addAlert({
        id: 'unique-key',
        message: 'Bzzzzzzp *crash*',
        variant: 'danger',
        noDuplicates: true,
      });
      AlertStore.addAlert({
        id: 'unique-key',
        message: 'Bzzzzzzp *crash*',
        variant: 'danger',
        noDuplicates: true,
      });

      expect(AlertStore.getState()).toHaveLength(1);
    });
  });

  describe('closeAlert()', () => {
    it('should remove alert', () => {
      const alerts = [
        {message: 'foo', variant: 'danger'},
        {message: 'bar', variant: 'danger'},
        {message: 'baz', variant: 'danger'},
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
    it('should persist removal of persistent alerts', () => {
      const alert = {
        key: 1,
        id: 'test',
        message: 'this is a test',
        variant: 'danger',
      } as const;

      AlertStore.closeAlert(alert);
      AlertStore.addAlert(alert);
      expect(AlertStore.getState()).toHaveLength(0);
    });
  });

  it('returns a stable reference from getState', () => {
    AlertStore.addAlert({
      message: 'Bzzzzzzp *crash*',
      variant: 'danger',
    });

    const state = AlertStore.getState();
    expect(Object.is(state, AlertStore.getState())).toBe(true);
  });
});
