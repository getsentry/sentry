import {ReplayDurationAndErrors} from '../replayTable';

export default function indexReplayEntriesById(
  array: ReplayDurationAndErrors[],
  key: string
) {
  return Object.fromEntries(array.map(item => [item[key], item]));
}
