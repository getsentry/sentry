import React from 'react';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Indicator, removeIndicator} from 'app/actionCreators/indicator';
import ToastIndicator from 'app/components/alerts/toastIndicator';
import IndicatorStore from 'app/stores/indicatorStore';
import {lightTheme} from 'app/utils/theme';

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

type State = {
  items: Indicator[];
};

class IndicatorsContainer extends React.Component<Omit<Props, 'items'>, State> {
  state: State = {items: IndicatorStore.get()};
  componentWillUnmount() {
    this.unlistener?.();
  }

  unlistener = IndicatorStore.listen((items: Indicator[]) => {
    this.setState({items});
  }, undefined);

  render() {
    // #NEW-SETTINGS - remove ThemeProvider here once new settings is merged
    // `alerts.html` django view includes this container and doesn't have a theme provider
    // not even sure it is used in django views but this is just an easier temp solution
    return (
      <ThemeProvider theme={lightTheme}>
        <Indicators {...this.props} items={this.state.items} />
      </ThemeProvider>
    );
  }
}

export default IndicatorsContainer;
export {Indicators};
