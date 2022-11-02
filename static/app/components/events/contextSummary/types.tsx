import {Event} from 'sentry/types';

type Meta = NonNullable<Event['_meta']>;

/**
 * The props passed to each context item
 */
export type ContextItemProps<D, M extends keyof Meta> = {
  data: D;
  meta: Meta[M];
  omitUnknownVersion?: boolean;
  unknownTitle?: string;
};

/**
 * Defines a context type
 */
export type Context = {
  Component: React.ComponentType<ContextItemProps<any, any>>;
  keys: string[];
  omitUnknownVersion?: boolean;
  unknownTitle?: string;
};
