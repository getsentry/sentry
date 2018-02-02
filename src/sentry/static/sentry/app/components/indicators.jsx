import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

import LoadingIndicator from '../components/loadingIndicator';
import ToastIndicator from '../components/alerts/toastIndicator';

import IndicatorStore from '../stores/indicatorStore';

class Indicators extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.oneOf(['error', 'success', '']),
        id: PropTypes.string,
        message: PropTypes.node,
      })
    ),
  };

  static defaultProps = {
    items: [],
  };

  render() {
    let {items, ...props} = this.props;
    return (
      <div {...props}>
        <ReactCSSTransitionGroup
          transitionName="toast"
          transitionEnter={false}
          transitionLeaveTimeout={500}
        >
          {items.map(indicator => {
            if (indicator.type === 'error' || indicator.type === 'success') {
              return (
                <ToastIndicator type={indicator.type} key={indicator.id}>
                  {indicator.message}
                </ToastIndicator>
              );
            } else {
              return (
                <LoadingIndicator className="toast" key={indicator.id}>
                  {indicator.message}
                </LoadingIndicator>
              );
            }
          })}
        </ReactCSSTransitionGroup>
      </div>
    );
  }
}

const IndicatorsContainer = createReactClass({
  displayName: 'IndicatorsContainer',
  mixins: [Reflux.connect(IndicatorStore, 'items')],

  getInitialState() {
    return {
      items: [],
    };
  },

  render() {
    return <Indicators {...this.props} items={this.state.items} />;
  },
});

export default IndicatorsContainer;
export {Indicators};
