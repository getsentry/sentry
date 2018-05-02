import PropTypes from 'prop-types';
import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';
import {defined, formatBytes} from 'app/utils';

class DeviceContextType extends React.Component {
  static propTypes = {
    alias: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  formatMemory = (memory_size, free_memory, usable_memory) => {
    if (
      !Number.isInteger(memory_size) ||
      memory_size <= 0 ||
      !Number.isInteger(free_memory) ||
      free_memory <= 0
    ) {
      return null;
    }

    let memory = `Total: ${formatBytes(memory_size)} / Free: ${formatBytes(free_memory)}`;
    if (Number.isInteger(usable_memory) && usable_memory > 0)
      memory += ` / Usable: ${formatBytes(usable_memory)}`;

    return memory;
  };

  formatStorage = (
    storage_size,
    free_storage,
    external_storage_size,
    external_free_storage
  ) => {
    if (!Number.isInteger(storage_size) || storage_size <= 0) return null;

    let storage = `Total: ${formatBytes(storage_size)}`;
    if (Number.isInteger(free_storage) && free_storage > 0)
      storage += ` / Free: ${formatBytes(free_storage)}`;

    if (
      Number.isInteger(external_storage_size) &&
      external_storage_size > 0 &&
      Number.isInteger(external_free_storage) &&
      external_free_storage > 0
    )
      storage += ` (External Total: ${formatBytes(
        external_storage_size
      )} / Free: ${formatBytes(external_free_storage)})`;

    return storage;
  };

  render() {
    let {
      name,
      family,
      model,
      model_id,
      arch,
      battery_level,
      orientation,
      simulator,
      memory_size,
      free_memory,
      usable_memory,
      storage_size,
      free_storage,
      external_storage_size,
      external_free_storage,
      boot_time,
      timezone,
      ...data
    } = this.props.data;
    let memory = this.formatMemory(memory_size, free_memory, usable_memory);
    let storage = this.formatStorage(
      storage_size,
      free_storage,
      external_storage_size,
      external_free_storage
    );
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['?Name', name],
          ['?Family', family],
          ['?Model', model + (model_id ? ` (${model_id})` : '')],
          ['?Architecture', arch],
          ['?Battery Level', defined(battery_level) ? `${battery_level}%` : null],
          ['?Orientation', orientation],
          ['?Memory', memory],
          ['?Capacity', storage],
          ['?Simulator', simulator],
          ['?Boot Time', boot_time],
          ['?Timezone', timezone],
        ]}
        alias={this.props.alias}
      />
    );
  }
}

DeviceContextType.getTitle = function(value) {
  return 'Device';
};

export default DeviceContextType;
