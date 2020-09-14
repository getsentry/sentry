import PropTypes from 'prop-types';
import React from 'react';

import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';

class CSPContent extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    const {data} = this.props;
    return (
      <div>
        <h4>
          <span>{data.effective_directive}</span>
        </h4>
        <KeyValueList data={Object.entries(data)} isContextData />
      </div>
    );
  }
}

export default CSPContent;
