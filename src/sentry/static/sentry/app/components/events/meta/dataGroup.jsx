import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import Annotated from 'app/components/events/meta/annotated';
import DataContext from 'app/components/events/meta/dataContext';
import pathShape from 'app/components/events/meta/pathShape';

function DataGroup({data, meta, path, children}) {
  return (
    <DataContext.Consumer>
      {parent => {
        let root = data ? new Annotated(data, meta) : parent;
        let parts = _.isString(path) ? path.split('.') : path;

        return (
          <DataContext.Provider value={root.get(...parts)}>
            {children}
          </DataContext.Provider>
        );
      }}
    </DataContext.Consumer>
  );
}

DataGroup.propTypes = {
  data: PropTypes.any,
  meta: PropTypes.object,
  path: pathShape,
  children: PropTypes.node.isRequired,
};

DataGroup.defaultProps = {
  path: [],
};

export default DataGroup;
