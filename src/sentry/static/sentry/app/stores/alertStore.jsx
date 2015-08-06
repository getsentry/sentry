
import Reflux from "reflux";
import AlertMessage from '../components/alertMessage';
import AlertActions from '../actions/alertActions';

var AlertStore = Reflux.createStore({
  listenables: AlertActions,

  init: function() {
    this.alerts = [];
    this.count = 0;
  },

  onAddAlert: function(message, type){
    this.alerts.push({
      id: this.count++,
      message: message,
      type: type
    });

    this.trigger(this.alerts);
  },

  onCloseAlert: function(id){
    this.alerts = this.alerts.filter(item => item.id !== id);
    this.trigger(this.alerts);
  }
});

export default AlertStore;

