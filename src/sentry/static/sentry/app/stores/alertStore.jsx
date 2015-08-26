import Reflux from "reflux";
import AlertActions from '../actions/alertActions';

var AlertStore = Reflux.createStore({
  listenables: AlertActions,

  init: function() {
    this.alerts = [];
    this.count = 0;
  },

  onAddAlert: function(message, type){
    // intentionally recreate array via concat because of Reflux
    // "bug" where React components are given same reference to tracked
    // data objects, and don't *see* that values have changed
    this.alerts = this.alerts.concat([{
      id: this.count++,
      message: message,
      type: type
    }]);

    this.trigger(this.alerts);
  },

  onCloseAlert: function(id){
    this.alerts = this.alerts.filter(item => item.id !== id);
    this.trigger(this.alerts);
  }
});

export default AlertStore;
