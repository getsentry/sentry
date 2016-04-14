import AlertStore from 'app/stores/alertStore';

describe('AlertStore', function () {
  beforeEach(function () {
    AlertStore.alerts = [];
    AlertStore.count = 0;
  });

  describe('onAddAlert()', function () {
    it('should add a new alert with incrementing key', function () {
      AlertStore.onAddAlert({
        message: 'Bzzzzzzp *crash*',
        type: 'error'
      });

      AlertStore.onAddAlert({
        message: 'Everything is super',
        type: 'info'
      });

      expect(AlertStore.alerts.length).to.eql(2);
      expect(AlertStore.alerts[0].key).to.eql(0);
      expect(AlertStore.alerts[1].key).to.eql(1);
    });
  });

  describe('onCloseAlert()', function () {
    it('should remove alert', function () {
      AlertStore.alerts = [
        {key: 1, message: 'foo', type: 'error'},
        {key: 2, message: 'bar', type: 'error'},
        {key: 3, message: 'baz', type: 'error'},
      ];

      AlertStore.onCloseAlert(AlertStore.alerts[1]);

      expect(AlertStore.alerts.length).to.eql(2);
      expect(AlertStore.alerts[0].key).to.eql(1);
      expect(AlertStore.alerts[1].key).to.eql(3);
    });
    it('should persist removal of persistent alerts', function () {
      let alert = {key: 1, id: 'test', message: 'foo', type: 'error'};
      AlertStore.onCloseAlert(alert);
      AlertStore.onAddAlert(alert);
      expect(AlertStore.alerts.length).to.eql(0);
    });
  });
});
