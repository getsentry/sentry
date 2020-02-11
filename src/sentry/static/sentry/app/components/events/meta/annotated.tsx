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
/**
 * Returns the value of `object[prop]` and returns an annotated component if
 * there is meta data
 */
const Annotated = <Values extends {}>({
  children,
  object,
  objectKey,
  required = false,
}: Props<Values>) => (
  <MetaData object={object} prop={objectKey} required={required}>
    {(value, meta) => {
      let toBeReturned = value;
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

export default Annotated;
