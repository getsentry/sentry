import PropTypes from 'prop-types';
import React from 'react';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import MetaData from 'app/components/events/meta/metaData';

/**
 * Returns the value of `object[prop]` and returns an annotated component if
 * there is meta data
 */
function Annotated({children, object, prop, required, ...other}) {
  return (
    <MetaData object={object} prop={prop} required={required}>
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
}

Annotated.propTypes = {
  object: PropTypes.object.isRequired,
  prop: PropTypes.string.isRequired,
  required: PropTypes.bool,
  children: PropTypes.func,
};

Annotated.defaultProps = {
  children: value => (typeof value === 'undefined' ? null : value),
  required: false,
};

export default Annotated;
