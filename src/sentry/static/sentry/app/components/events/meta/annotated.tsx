import React from 'react';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import MetaData from 'app/components/events/meta/metaData';

type Props<Values> = {
  object: Values;
  objectKey: Extract<keyof Values, string>;
  required?: boolean;
  children: (value: string | null | React.ReactNode) => React.ReactNode;
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
  ...other
}: Props<Values>) => (
  <MetaData object={object} prop={objectKey} required={required}>
    {(value, meta) => {
      if (meta) {
        value = (
          <AnnotatedText
            value={value}
            chunks={meta.chunks}
            remarks={meta.rem}
            errors={meta.err}
            props={other}
          />
        );
      }
      return children(value);
    }}
  </MetaData>
);

export default Annotated;
