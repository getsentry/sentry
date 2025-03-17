import type {ReactNode} from 'react';

export interface AggregateFunction {
  name: string;
  label?: ReactNode;
  // TODO: add other attributes here like arguments
}

export interface FunctionArgument {
  name: string;
  label?: ReactNode;
  // TODO: add other attributes here like argument type
}
