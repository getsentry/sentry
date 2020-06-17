import React from 'react';
import {LocationDescriptor} from 'history';

export type SpanEntryContextChildrenProps = {
  getViewChildTransactionTarget: (props: {
    'project.name': string;
    transaction: string;
    id: string;
    eventSlug: string;
  }) => LocationDescriptor | undefined;
};

const SpanEntryContext = React.createContext<SpanEntryContextChildrenProps>({
  getViewChildTransactionTarget: () => undefined,
});

export const Provider = SpanEntryContext.Provider;

export const Consumer = SpanEntryContext.Consumer;
