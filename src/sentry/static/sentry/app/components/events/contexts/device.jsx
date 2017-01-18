import React from 'react';

import ContextBlock from './contextBlock';
import {defined, formatBytes} from '../../../utils';

const DeviceContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  formatMemory(memory_size, free_memory, usable_memory) {
    if (!Number.isInteger(memory_size) || memory_size <= 0 ||
       !Number.isInteger(free_memory) || free_memory <= 0 ||
       !Number.isInteger(usable_memory) || usable_memory <= 0) {
      return null;
    }
    return `Total: ${formatBytes(memory_size)} / Usable: ${formatBytes(usable_memory)} / Free: ${formatBytes(free_memory)}`;
  },

  formatStorage(storage_size) {
    if (!Number.isInteger(storage_size) || storage_size <= 0)
      return null;

    return `${formatBytes(storage_size)}`;
  },

  render() {
    let {name, family, model, model_id, arch, battery_level, orientation,
      simulator, memory_size, free_memory, usable_memory, storage_size,
      ...data} = this.props.data;
      let memory = this.formatMemory(memory_size, free_memory, usable_memory);
      let storage = this.formatStorage(storage_size);
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
