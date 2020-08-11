import {AnimatePresence} from 'framer-motion';
import {ThemeProvider} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {removeIndicator, Indicator} from 'app/actionCreators/indicator';
import IndicatorStore from 'app/stores/indicatorStore';
import ToastIndicator from 'app/components/alerts/toastIndicator';
import theme from 'app/utils/theme';

const Toasts = styled('div')`
  position: fixed;
  right: 30px;
  bottom: 30px;
  z-index: ${p => p.theme.zIndex.toast};
`;

type Props = {
  items: Indicator[];
  className?: string;
};

class Indicators extends React.Component<Props> {
  static propTypes = {
    className: PropTypes.string,
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

  handleDismiss = (indicator: Indicator) => {
    removeIndicator(indicator);
  };

  render() {
    const {items, ...props} = this.props;

    return (
      <Toasts {...props}>
        <AnimatePresence>
          {items.map((indicator, i) => (
            // We purposefully use `i` as key here because of transitions
            // Toasts can now queue up, so when we change from [firstToast] -> [secondToast],
            // we don't want to  animate `firstToast` out and `secondToast` in, rather we want
            // to replace `firstToast` with `secondToast`
            <ToastIndicator
              onDismiss={this.handleDismiss}
              indicator={indicator}
              key={i}
            />
          ))}
        </AnimatePresence>
      </Toasts>
    );
  }
}

const IndicatorsContainer = createReactClass<Omit<Props, 'items'>>({
  displayName: 'IndicatorsContainer',
  mixins: [Reflux.connect(IndicatorStore, 'items') as any],

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
