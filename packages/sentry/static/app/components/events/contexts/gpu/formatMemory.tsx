import {formatBytesBase2} from 'sentry/utils';

const MEGABYTE_IN_BYTES = 1048576;

function formatMemory(memory_size: number) {
  if (!Number.isInteger(memory_size) || memory_size <= 0) {
    return null;
  }

  // 'usable_memory' is in defined in MB
  return formatBytesBase2(memory_size * MEGABYTE_IN_BYTES);
}

export default formatMemory;
