import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import DataField from 'app/components/events/meta/dataField';
import pathShape from 'app/components/events/meta/pathShape';

function DataText({children, path, required, ...other}) {
  return (
    <DataField path={path} required={required}>
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
        } else if (!_.isNil(value) && !_.isEmpty(other)) {
          value = <span {...other}>{value}</span>;
        }

        return children(value);
      }}
    </DataField>
  );
}

DataText.propTypes = {
  children: PropTypes.func,
  path: pathShape,
  required: PropTypes.bool,
};

DataText.defaultProps = {
  children: value => value,
  path: [],
  required: false,
};

export default DataText;
