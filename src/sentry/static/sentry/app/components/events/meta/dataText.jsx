import PropTypes from 'prop-types';
import React from 'react';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import MetaData from 'app/components/events/meta/metaData';

// TODO: Rename this to maybe Annotated?
function DataText({children, object, prop, required, ...other}) {
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

DataText.propTypes = {
  object: PropTypes.object.isRequired,
  prop: PropTypes.string.isRequired,
  required: PropTypes.bool,
  children: PropTypes.func,
};

DataText.defaultProps = {
  children: value => value,
  required: false,
};

export default DataText;
