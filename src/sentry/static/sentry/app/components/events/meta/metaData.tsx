import React from 'react';
import isNil from 'lodash/isNil';

import {getMeta} from 'app/components/events/meta/metaProxy';
import ErrorBoundary from 'app/components/errorBoundary';
import {Meta} from 'app/types';

type Props<Values, K extends Extract<keyof Values, string>> = {
  object: Values;
  prop: K;
  /**
   * Render prop that is called with these args:
   *  value: The actual value,
   *  meta: metadata object if it exists, otherwise undefined,
   */
  children: (value: Values[K], meta?: Meta) => React.ReactNode;
  required: boolean;
};

/**
 * Retrieves metadata from an object (object should be a proxy that
 * has been decorated using `app/components/events/meta/metaProxy/withMeta`
 */
const MetaData = <Values extends {}>({
  children,
  object,
  prop,
  required,
}: Props<Values, Extract<keyof Values, string>>) => {
  const value = object[prop];
  const meta = getMeta(object, prop);

  if (required && isNil(value) && !meta) {
    return null;
  }

  return <ErrorBoundary mini>{children(value, meta)}</ErrorBoundary>;
};

export default MetaData;
