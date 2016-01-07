import React from 'react';
import Reflux from 'reflux';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

import LoadingIndicator from '../components/loadingIndicator';
import ToastIndicator from '../components/alerts/toastIndicator';

import IndicatorStore from '../stores/indicatorStore';

const Indicators = React.createClass({
  mixins: [
    Reflux.connect(IndicatorStore, 'items')
  ],

  getInitialState() {
      return {
          items: []
      };
  },

  render() {
    return (
      <div {...this.props}>
        <ReactCSSTransitionGroup transitionName="toast" transitionEnter={false} transitionLeaveTimeout={500}>
          {this.state.items.map((indicator) => {
            if (indicator.type === 'error' || indicator.type === 'success') {
              return (
                <ToastIndicator type={indicator.type} key={indicator.id}>{indicator.message}</ToastIndicator>
              );
            } else {
              return (
                <LoadingIndicator className="toast" key={indicator.id}>{indicator.message}</LoadingIndicator>
              );
            }
          })}
        </ReactCSSTransitionGroup>
      </div>
    );
  }
});

export default Indicators;

