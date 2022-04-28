import {Replay} from '../types';

export default function mergeReplayEntries(array: Replay[], key: string) {
  const initialValue = {};
  return array.reduce((obj, item) => {
    return {
      ...obj,
      [item[key]]: item,
    };
  }, initialValue);
}
