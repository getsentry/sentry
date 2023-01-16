import {Component, createContext} from 'react';

import {ProcessedSpanType} from './types';

export type SpanContextProps = {
  addExpandedSpan: (span: Readonly<ProcessedSpanType>, callback?: () => void) => void;
  didAnchoredSpanMount: () => boolean;
  isSpanExpanded: (span: Readonly<ProcessedSpanType>) => boolean;
  markAnchoredSpanIsMounted: () => void;
  removeExpandedSpan: (span: Readonly<ProcessedSpanType>, callback?: () => void) => void;
};

const SpanContext = createContext<SpanContextProps>({
  didAnchoredSpanMount: () => false,
  markAnchoredSpanIsMounted: () => undefined,
  addExpandedSpan: () => undefined,
  removeExpandedSpan: () => undefined,
  isSpanExpanded: () => false,
});

type Props = {
  children: React.ReactNode;
};

export class Provider extends Component<Props> {
  isAnchoredSpanMounted = false;

  // This set keeps track of all spans which are currently expanded to show their details.
  // Since the span tree is virtualized, we need this so the tree can remember which spans have been expanded after they unmount
  expandedSpansMap: Set<Readonly<ProcessedSpanType>> = new Set();

  markAnchoredSpanIsMounted = () => (this.isAnchoredSpanMounted = true);
  didAnchoredSpanMount = () => this.isAnchoredSpanMounted;

  addExpandedSpan = (span: Readonly<ProcessedSpanType>, callback?: () => void) => {
    this.expandedSpansMap.add(span);
    callback?.();
  };

  removeExpandedSpan = (span: Readonly<ProcessedSpanType>, callback?: () => void) => {
    this.expandedSpansMap.delete(span);
    callback?.();
  };

  isSpanExpanded = (span: Readonly<ProcessedSpanType>) => {
    return this.expandedSpansMap.has(span);
  };

  render() {
    const childrenProps: SpanContextProps = {
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
