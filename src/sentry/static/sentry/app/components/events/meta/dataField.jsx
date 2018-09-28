import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import DataContext from 'app/components/events/meta/dataContext';
import pathShape from 'app/components/events/meta/pathShape';

function DataField({children, path, required}) {
  return (
    <DataContext.Consumer>
      {context => {
        let parts = _.isString(path) ? path.split('.') : path || [];
        let data = context.get(...parts);
        let meta = data.annotated() ? data.meta[''] : null;
        return required && _.isNil(data) && !meta ? null : children(data.value, meta);
      }}
    </DataContext.Consumer>
  );
}

DataField.propTypes = {
  children: PropTypes.func.isRequired,
  path: pathShape,
  required: PropTypes.bool,
};

DataField.defaultProps = {
  path: [],
  required: false,
};

export default DataField;
