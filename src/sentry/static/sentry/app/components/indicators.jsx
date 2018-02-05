import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import styled from 'react-emotion';

import ToastIndicator from '../components/alerts/toastIndicator';

import IndicatorStore from '../stores/indicatorStore';

const Toasts = styled.div`
  position: fixed;
  right: 30px;
  bottom: 30px;
`;

class Indicators extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.oneOf(['error', 'success', 'loading', '']),
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
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
      <Toasts {...props}>
        <ReactCSSTransitionGroup
          transitionName="toast"
          transitionEnterTimeout={6000}
          transitionLeaveTimeout={200}
        >
          {items.map(indicator => {
            return (
              <ToastIndicator type={indicator.type} key={indicator.id}>
                {indicator.message}
              </ToastIndicator>
            );
          })}
        </ReactCSSTransitionGroup>
      </Toasts>
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
