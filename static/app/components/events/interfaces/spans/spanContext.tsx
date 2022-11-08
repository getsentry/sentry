import {createContext} from 'react';

type SpanContextProps = {
  didAnchoredSpanMount: boolean;
};

export const SpanContext = createContext<SpanContextProps>({didAnchoredSpanMount: false});
