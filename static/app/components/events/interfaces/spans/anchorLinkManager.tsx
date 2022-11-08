import {Component, createContext} from 'react';

export type AnchorLinkManagerChildrenProps = {
  isAnchoredSpanFound: boolean;
  registerScrollFn: (hash: string, fn: () => void, isSpanInGroup: boolean) => void;
  scrollToHash: (hash: string) => void;
  markAnchoredSpanFound: () => void;
};

const AnchorLinkManagerContext = createContext<AnchorLinkManagerChildrenProps>({
  registerScrollFn: () => () => undefined,
  scrollToHash: () => undefined,
  isAnchoredSpanFound: false,
  markAnchoredSpanFound: () => undefined,
});

type Props = {
  children: React.ReactNode;
};

export class Provider extends Component<Props> {
  componentDidMount() {
    this.scrollToHash(location.hash);
  }

  scrollFns: Map<string, {fn: () => void; isSpanInGroup: boolean}> = new Map();
  isAnchoredSpanFound = false;

  scrollToHash = (hash: string) => {
    // if (this.scrollFns.has(hash)) {
    //   const {fn, isSpanInGroup} = this.scrollFns.get(hash)!;
    //   fn();
    //   // If the anchored span is part of a group, need to call scrollToHash again, since the initial fn() call will only expand the group.
    //   // The function gets registered again after the group is expanded, which will allow the page to scroll to the span
    //   if (isSpanInGroup) {
    //     // TODO: There's a possibility that this trick may not work when we upgrade to React 18
    //     setTimeout(() => this.scrollFns.get(hash)?.fn());
    //   }
    // }
  };

  registerScrollFn = (hash: string, fn: () => void, isSpanInGroup: boolean) => {
    this.scrollFns.set(hash, {fn, isSpanInGroup});
  };

  markAnchoredSpanFound = () => {
    this.isAnchoredSpanFound = true;
  };

  render() {
    const childrenProps: AnchorLinkManagerChildrenProps = {
      registerScrollFn: this.registerScrollFn,
      scrollToHash: this.scrollToHash,
      isAnchoredSpanFound: this.isAnchoredSpanFound,
      markAnchoredSpanFound: this.markAnchoredSpanFound,
    };

    return (
      <AnchorLinkManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </AnchorLinkManagerContext.Provider>
    );
  }
}

export const Consumer = AnchorLinkManagerContext.Consumer;
