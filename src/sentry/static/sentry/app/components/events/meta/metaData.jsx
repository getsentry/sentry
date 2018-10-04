import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import {getMeta} from 'app/components/events/meta/metaProxy';

/**
 * Retrieves metadata from an object (object should be a proxy that
 * has been decorated using `app/components/events/meta/metaProxy/decorateEvent`
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
    let {children, object, prop, required} = this.props;

    let value = object[prop];
    let meta = getMeta(object, prop);
    return required && _.isNil(value) && !meta ? null : children(value, meta);
  }
}
