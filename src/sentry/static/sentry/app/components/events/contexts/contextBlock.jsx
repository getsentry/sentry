import PropTypes from 'prop-types';
import React from 'react';
import sortBy from 'lodash/sortBy';

import {defined} from 'app/utils';
import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';

class ContextBlock extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    knownData: PropTypes.array,
  };

  render() {
    let data = [];
    const className = `context-block context-block-${this.props.data.type}`;

    (this.props.knownData || []).forEach(([key, value]) => {
      let allowSkip = false;
      if (key[0] === '?') {
        allowSkip = true;
        key = key.substr(1);
      }
      if (!defined(value)) {
        if (allowSkip) {
          return;
        }
        value = 'n/a';
      }
      data.push([key, value]);
    });

    const extraData = [];
    for (const key in this.props.data) {
      if (key !== 'type' && key !== 'title') {
        extraData.push([key, this.props.data[key]]);
      }
    }

    if (extraData.length > 0) {
      data = data.concat(sortBy(extraData, key => key));
    }

    return (
      <div className={className}>
        <ErrorBoundary mini>
          <KeyValueList data={data} isSorted={false} isContextData />
        </ErrorBoundary>
      </div>
    );
  }
}

export default ContextBlock;
