import React from 'react';

import ContextBlock from './contextBlock';
import {defined, formatBytes} from '../../../utils';

const DeviceContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  formatMemory(memorySize, freeMemory, usableMemory) {
    if (!Number.isInteger(memorySize) ||
       !Number.isInteger(freeMemory) ||
       !Number.isInteger(usableMemory)) {
      return null;
    }
    return `Total: ${formatBytes(memorySize)} / Usable: ${formatBytes(usableMemory)} / Free: ${formatBytes(freeMemory)}`;
  },

  formatStorage(storageSize) {
    if (!Number.isInteger(storageSize))
      return null;

    return `${formatBytes(storageSize)}`;
  },

  render() {
    let {name, family, model, model_id, arch, battery_level, orientation,
      simulator, memorySize, freeMemory, usableMemory, storageSize,
      ...data} = this.props.data;
      let memory = this.formatMemory(memorySize, freeMemory, usableMemory);
      let storage = this.formatStorage(storageSize);
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['?Name', name],
          ['Family', family],
          ['Model', model + (model_id ? ` (${model_id})` : '')],
          ['Architecture', arch],
          ['?Battery Level', defined(battery_level)
            ? `${battery_level}%` : null],
          ['?Orientation', orientation],
          ['?Memory', memory],
          ['?Capacity', storage],
          ['?Simulator', simulator],
        ]}
        alias={this.props.alias} />
    );
  }
});

DeviceContextType.getTitle = function(value) {
  return 'Device';
};

export default DeviceContextType;
