import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import styled from 'react-emotion';
import {ThemeProvider} from 'emotion-theming';
import {cx} from 'emotion';

import ToastIndicator from 'app/components/alerts/toastIndicator';
import IndicatorStore from 'app/stores/indicatorStore';
import theme from 'app/utils/theme';
import {removeIndicator} from 'app/actionCreators/indicator';

const Toasts = styled.div`
  position: fixed;
  right: 30px;
  bottom: 30px;
  z-index: ${p => p.theme.zIndex.toast};
`;

class Indicators extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.oneOf(['error', 'success', 'loading', 'undo', '']),
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        message: PropTypes.node,
        options: PropTypes.object,
      })
    ),
  };

  static defaultProps = {
    items: [],
  };

  handleDismiss = indicator => {
    removeIndicator(indicator);
  };

  render() {
    let {items, className, ...props} = this.props;

    return (
      <Toasts {...props} className={cx(className, 'ref-toasts')}>
        <ReactCSSTransitionGroup
          transitionName="toast"
          transitionEnterTimeout={400}
          transitionLeaveTimeout={400}
        >
          {items.map((indicator, i) => {
            // We purposefully use `i` as key here because of transitions
            // Toasts can now queue up, so when we change from [firstToast] -> [secondToast],
            // we don't want to  animate `firstToast` out and `secondToast` in, rather we want
            // to replace `firstToast` with `secondToast`
            return (
              <ToastIndicator
                onDismiss={this.handleDismiss}
                indicator={indicator}
                key={i}
              />
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
    // #NEW-SETTINGS - remove ThemeProvider here once new settings is merged
    // `alerts.html` django view includes this container and doesn't have a theme provider
    // not even sure it is used in django views but this is just an easier temp solution
    return (
      <ThemeProvider theme={theme}>
        <Indicators {...this.props} items={this.state.items} />
      </ThemeProvider>
    );
  },
});

export default IndicatorsContainer;
export {Indicators};
