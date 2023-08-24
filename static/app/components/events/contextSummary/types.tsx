import {MetaContainer} from 'sentry/components/events/meta/metaContainer';

/**
 * The props passed to each context item
 */
export type ContextItemProps<D> = {
  data: D;
  meta: MetaContainer;
  omitUnknownVersion?: boolean;
  unknownTitle?: string;
};

/**
 * Defines a context type
 */
export type Context = {
  Component: React.ComponentType<ContextItemProps<any>>;
  keys: string[];
  omitUnknownVersion?: boolean;
  unknownTitle?: string;
};
