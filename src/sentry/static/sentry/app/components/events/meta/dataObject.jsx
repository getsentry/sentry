import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import DataContext from 'app/components/events/meta/dataContext';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import pathShape from 'app/components/events/meta/pathShape';

function convert(data) {
  let value = data.value;

  if (_.isObject(value)) {
    return _.mapValues(value, (v, key) => convert(data.get(key)));
  }

  if (_.isArray(value)) {
    return _.map(value, (v, i) => convert(data.get(i)));
  }

  if (data.annotated()) {
    let meta = data.meta && data.meta[''];
    return (
      <AnnotatedText
        value={value}
        chunks={meta.chunks}
        remarks={meta.rem}
        errors={meta.err}
      />
    );
  }

  return value;
}

function DataObject({children, path, required}) {
  return (
    <DataContext.Consumer>
      {context => {
        let parts = _.isString(path) ? path.split('.') : _.castArray(path);
        let value = convert(context.get(...parts));
        return required && _.isEmpty(value) && value !== '' && value !== 0
          ? null
          : children(value);
      }}
    </DataContext.Consumer>
  );
}

DataObject.propTypes = {
  children: PropTypes.func.isRequired,
  path: pathShape,
  required: PropTypes.bool,
};

DataObject.defaultProps = {
  path: [],
  required: false,
};

export default DataObject;
