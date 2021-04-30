import React from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';

export type AnchorLinkManagerChildrenProps = {
  registerScrollFn: (id: string, fn: () => void) => () => void;
};

const AnchorLinkManagerContext = React.createContext<AnchorLinkManagerChildrenProps>({
  registerScrollFn: () => () => undefined,
});

type Props = WithRouterProps & {
  children: React.ReactNode;
};

class AnchorLinkManagerProvider extends React.Component<Props> {
  componentDidMount() {
    const {location} = this.props;
    this.scrollToHash(location.hash);
  }

  scrollFns: Map<string, () => void> = new Map();

  scrollToHash = (hash: string) => {
    this.scrollFns.get(hash)?.();
  };

  registerScrollFn = (hash: string, fn: () => void) => {
    this.scrollFns.set(hash, fn);

    return () => {
      const {location} = this.props;

      this.scrollToHash(hash);
      // make sure to update the location
      //
      // TODO(txiao): This is causing a rerender of the whole page,
      // which can be slow.
      browserHistory.push({
        ...location,
        hash,
      });
    };
  };

  render() {
    const childrenProps: AnchorLinkManagerChildrenProps = {
      registerScrollFn: this.registerScrollFn,
    };

    return (
      <AnchorLinkManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </AnchorLinkManagerContext.Provider>
    );
  }
}

export const Provider = withRouter(AnchorLinkManagerProvider);

export const Consumer = AnchorLinkManagerContext.Consumer;
