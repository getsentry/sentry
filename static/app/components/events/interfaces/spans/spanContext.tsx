import {Component, createContext} from 'react';

export type SpanContextProps = {
  addExpandedSpan: (spanId: string) => void;
  didAnchoredSpanMount: boolean;
  isSpanExpanded: (spanId: string) => boolean;
  markAnchoredSpanIsMounted: () => void;
  registerScrollFn: (hash: string, fn: () => void, isSpanInGroup: boolean) => void;
  removeExpandedSpan: (spanId: string) => void;
  scrollToHash: (hash: string) => void;
};

const SpanContext = createContext<SpanContextProps>({
  registerScrollFn: () => () => undefined,
  scrollToHash: () => undefined,
  didAnchoredSpanMount: false,
  markAnchoredSpanIsMounted: () => undefined,
  addExpandedSpan: () => undefined,
  removeExpandedSpan: () => undefined,
  isSpanExpanded: () => false,
});

type Props = {
  children: React.ReactNode;
};

export class Provider extends Component<Props> {
  componentDidMount() {
    this.scrollToHash(location.hash);
  }

  scrollFns: Map<string, {fn: () => void; isSpanInGroup: boolean}> = new Map();
  didAnchoredSpanMount = false;

  // This set keeps track of all spans which are currently expanded to show their details.
  // Since the span tree is virtualized, we need this so the tree can remember which spans have been expanded after they unmount
  expandedSpansMap: Set<string> = new Set();

  scrollToHash = (_: string) => {
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

  markAnchoredSpanIsMounted = () => {
    this.didAnchoredSpanMount = true;
  };

  addExpandedSpan = (spanId: string) => {
    this.expandedSpansMap.add(spanId);
  };

  removeExpandedSpan = (spanId: string) => {
    this.expandedSpansMap.delete(spanId);
  };

  isSpanExpanded = (spanId: string) => {
    return this.expandedSpansMap.has(spanId);
  };

  render() {
    const childrenProps: SpanContextProps = {
      registerScrollFn: this.registerScrollFn,
      scrollToHash: this.scrollToHash,
      didAnchoredSpanMount: this.didAnchoredSpanMount,
      markAnchoredSpanIsMounted: this.markAnchoredSpanIsMounted,
      addExpandedSpan: this.addExpandedSpan,
      removeExpandedSpan: this.removeExpandedSpan,
      isSpanExpanded: this.isSpanExpanded,
    };

    return (
      <SpanContext.Provider value={childrenProps}>
        {this.props.children}
      </SpanContext.Provider>
    );
  }
}

export const Consumer = SpanContext.Consumer;
