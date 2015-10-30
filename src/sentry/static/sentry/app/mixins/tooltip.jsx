import ReactDOM from 'react-dom';
import $ from 'jquery';
import 'bootstrap/js/tooltip';

export default function (options) {
  options = options || {};
  return {
    componentDidMount() {
      this.attachTooltips();
    },

    componentWillUnmount() {
      this.removeTooltips();
      $(ReactDOM.findDOMNode(this)).unbind();
    },

    attachTooltips() {
      $(ReactDOM.findDOMNode(this)).tooltip(
        Object.prototype.toString.call(options) === '[object Function]' ?
          options.call(this) : options
      );
    },

    removeTooltips() {
      $(ReactDOM.findDOMNode(this))
        .tooltip('destroy') // destroy tooltips on parent ...
        .find(options.selector)
          .tooltip('destroy'); // ... and descendents
    }
  };
}
