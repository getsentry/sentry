import {formatBytesBase2} from 'app/utils';

function formatStorage(
  storage_size: number,
  free_storage: number,
  external_storage_size: number,
  external_free_storage: number
) {
  if (!Number.isInteger(storage_size) || storage_size <= 0) {
    return null;
  }

  let storage = `Total: ${formatBytesBase2(storage_size)}`;
  if (Number.isInteger(free_storage) && free_storage > 0) {
    storage = `${storage} / Free: ${formatBytesBase2(free_storage)}`;
  }

  if (
    Number.isInteger(external_storage_size) &&
    external_storage_size > 0 &&
    Number.isInteger(external_free_storage) &&
    external_free_storage > 0
  ) {
    storage = `${storage} (External Total: ${formatBytesBase2(
      external_storage_size
    )} / Free: ${formatBytesBase2(external_free_storage)})`;
  }

  return storage;
}

export default formatStorage;
