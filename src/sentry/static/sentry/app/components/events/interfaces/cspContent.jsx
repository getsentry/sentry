import React from 'react';

import {objectToArray} from '../../../utils';
import KeyValueList from './keyValueList';

const CSPContent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {data} = this.props;
    return (
      <div>
        <h4>
          <span>{data.effective_directive}</span>
        </h4>
        <KeyValueList data={objectToArray(data)} isContextData={true}/>
      </div>
    );
  }
});

export default CSPContent;
