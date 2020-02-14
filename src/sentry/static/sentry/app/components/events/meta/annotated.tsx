import React from 'react';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import MetaData from 'app/components/events/meta/metaData';
import {isFunction} from 'app/utils';

type Props<Values> = {
  object: Values;
  objectKey: Extract<keyof Values, string>;
  required?: boolean;
  children: (value: string | null | React.ReactNode) => React.ReactNode | string;
};

type ReturnedMetaValue = string | number | boolean | null;
/**
 * Returns the value of `object[prop]` and returns an annotated component if
 * there is meta data
 */
const Annotated = <Values extends {}>({
  children,
  object,
  objectKey,
  required = false,
}: Props<Values>) => {
  const getToBeReturnedMetaValue = (
    metaValue: ReturnedMetaValue
  ): React.ReactNode | ReturnedMetaValue => {
    if (typeof metaValue === 'number' || typeof metaValue === 'boolean') {
      return metaValue;
    }

    return metaValue || null;
  };
  return (
    <MetaData object={object} prop={objectKey} required={required}>
      {(value, meta) => {
        let toBeReturned = getToBeReturnedMetaValue(value);
        if (meta) {
          toBeReturned = (
            <AnnotatedText
              value={value}
              chunks={meta.chunks}
              remarks={meta.rem}
              errors={meta.err}
            />
          );
        }
        return isFunction(children) ? children(toBeReturned) : toBeReturned;
      }}
    </MetaData>
  );
};

export default Annotated;
