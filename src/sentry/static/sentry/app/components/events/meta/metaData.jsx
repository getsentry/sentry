import PropTypes from 'prop-types';
import React from 'react';
import isNil from 'lodash/isNil';

import {getMeta} from 'app/components/events/meta/metaProxy';
import ErrorBoundary from 'app/components/errorBoundary';

/**
 * Retrieves metadata from an object (object should be a proxy that
 * has been decorated using `app/components/events/meta/metaProxy/withMeta`
 */
export default class MetaData extends React.Component {
  static propTypes = {
    object: PropTypes.object.isRequired,
    prop: PropTypes.string.isRequired,
    /**
     * Render prop that is called with these args:
     *  value: The actual value,
     *  meta: metadata object if it exists, otherwise null,
     */
    children: PropTypes.func.isRequired,
    required: PropTypes.bool,
  };

  render() {
    const {children, object, prop, required} = this.props;

    const value = object[prop];
    const meta = getMeta(object, prop);

    return (
      <ErrorBoundary mini>
        {required && isNil(value) && !meta ? null : children(value, meta)}
      </ErrorBoundary>
    );
  }
}
