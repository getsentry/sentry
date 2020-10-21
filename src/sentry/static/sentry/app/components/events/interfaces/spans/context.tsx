import { createContext } from 'react';
import {LocationDescriptor} from 'history';

type ChildTransaction = {
  'project.name': string;
  transaction: string;
  id: string;
  eventSlug: string;
};

export type SpanEntryContextChildrenProps = {
  getViewChildTransactionTarget: (
    props: ChildTransaction
  ) => LocationDescriptor | undefined;
};

const SpanEntryContext = createContext<SpanEntryContextChildrenProps>({
  getViewChildTransactionTarget: () => undefined,
});

export const Provider = SpanEntryContext.Provider;

export const Consumer = SpanEntryContext.Consumer;
