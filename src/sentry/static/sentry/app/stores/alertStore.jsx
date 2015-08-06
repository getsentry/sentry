
import Reflux from "reflux";
import AlertMessage from '../components/alertMessage';
import AlertActions from '../actions/alertActions';

var AlertStore = Reflux.createStore({
  listenables: AlertActions,

  init: function() {
    this.alerts = [];
  },

  onAddAlert: function(message, type){
    if (React.isValidElement(message)) {
      this.alerts.push(message);
    } else {
      this.alerts.push(<AlertMessage type={type}>{message}</AlertMessage>);
    }
    this.trigger(this.alerts);
  },

  onCloseAlert: function(alert){
    this.alerts = this.alerts.filter(function(item){
      // XXX(dcramer): there is likely a safer way to do this that isnt using
      // what seems to be a private operator
      return item !== alert._currentElement;
    });
    this.trigger(this.alerts);
  }
});

export default AlertStore;

