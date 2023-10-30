import AlertStore from 'sentry/stores/alertStore';

jest.mock('sentry/utils/localStorage');

describe('AlertStore', function () {
  beforeEach(function () {
    AlertStore.alerts = [];
    AlertStore.count = 0;
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

      expect(AlertStore.alerts).toHaveLength(2);
      expect(AlertStore.alerts[0].key).toEqual(0);
      expect(AlertStore.alerts[1].key).toEqual(1);
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

      expect(AlertStore.alerts).toHaveLength(1);
    });
  });

  describe('closeAlert()', function () {
    it('should remove alert', function () {
      AlertStore.alerts = [
        {key: 1, message: 'foo', type: 'error'},
        {key: 2, message: 'bar', type: 'error'},
        {key: 3, message: 'baz', type: 'error'},
      ];

      AlertStore.closeAlert(AlertStore.alerts[1]);

      expect(AlertStore.alerts).toHaveLength(2);
      expect(AlertStore.alerts[0].key).toEqual(1);
      expect(AlertStore.alerts[1].key).toEqual(3);
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
      expect(AlertStore.alerts).toHaveLength(0);
    });
  });
});
