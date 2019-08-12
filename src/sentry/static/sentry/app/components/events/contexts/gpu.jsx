import PropTypes from 'prop-types';
import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';
import {formatBytes} from 'app/utils';

const megaByteInBytes = 1048576;

class GpuContextType extends React.Component {
  static propTypes = {
    alias: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  formatMemory = memory_size => {
    if (!Number.isInteger(memory_size) || memory_size <= 0) {
      return null;
    }

    // 'usable_memory' is in defined in MB
    return formatBytes(memory_size * megaByteInBytes);
  };

  render() {
    const {
      id,
      name,
      version,
      vendor_name,
      vendor_id,
      memory_size,
      npot_support,
      multi_threaded_rendering,
      api_type,
      ...data
    } = this.props.data;

    const memory = this.formatMemory(memory_size);
    const knownData = [
      ['?Name', name],
      ['?Version', version],
      ['?Vendor', vendor_name],
      ['?Memory', memory],
      ['?NPOT Support', npot_support],
      ['?Multi-Thread rendering', multi_threaded_rendering],
      ['?API Type', api_type],
    ];

    if (vendor_id > 0) {
      knownData.unshift(['?Vendor Id', vendor_id]);
    }

    if (id > 0) {
      knownData.unshift(['?GPU Id', id]);
    }

    return <ContextBlock data={data} knownData={knownData} alias={this.props.alias} />;
  }
}

GpuContextType.getTitle = () => 'GPU';

export default GpuContextType;
