import AlertStore from 'app/stores/alertStore';

describe('AlertStore', function () {
  beforeEach(function () {
    AlertStore.alerts = [];
    AlertStore.count = 0;
  });

  describe('onAddAlert()', function () {
    it('should add a new alert with incrementing id', function () {
      AlertStore.onAddAlert({
        message: 'Bzzzzzzp *crash*',
        type: 'error'
      });

      AlertStore.onAddAlert({
        message: 'Everything is super',
        type: 'info'
      });

      expect(AlertStore.alerts.length).to.eql(2);
      expect(AlertStore.alerts[0].id).to.eql(0);
      expect(AlertStore.alerts[1].id).to.eql(1);
    });
  });

  describe('onCloseAlert()', function () {
    it('should remove alert with given id', function () {
      AlertStore.alerts = [
        {id: 1, message: 'foo', type: 'error '},
        {id: 2, message: 'bar', type: 'error '},
        {id: 3, message: 'baz', type: 'error '},
      ];

      AlertStore.onCloseAlert(2);

      expect(AlertStore.alerts.length).to.eql(2);
      expect(AlertStore.alerts[0].id).to.eql(1);
      expect(AlertStore.alerts[1].id).to.eql(3);
    });
  });
});
