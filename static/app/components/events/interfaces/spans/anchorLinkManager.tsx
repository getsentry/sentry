import React from 'react';

export type AnchorLinkManagerChildrenProps = {
  registerScrollFn: (id: string, fn: () => void) => void;
  scrollToHash: (hash: string) => void;
};

const AnchorLinkManagerContext = React.createContext<AnchorLinkManagerChildrenProps>({
  registerScrollFn: () => () => undefined,
  scrollToHash: () => undefined,
});

type Props = {
  children: React.ReactNode;
};

export class Provider extends React.Component<Props> {
  componentDidMount() {
    this.scrollToHash(location.hash);
  }

  scrollFns: Map<string, () => void> = new Map();

  scrollToHash = (hash: string) => {
    this.scrollFns.get(hash)?.();
  };

  registerScrollFn = (hash: string, fn: () => void) => {
    this.scrollFns.set(hash, fn);
  };

  render() {
    const childrenProps: AnchorLinkManagerChildrenProps = {
      registerScrollFn: this.registerScrollFn,
      scrollToHash: this.scrollToHash,
    };

    return (
      <AnchorLinkManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </AnchorLinkManagerContext.Provider>
    );
  }
}

export const Consumer = AnchorLinkManagerContext.Consumer;
