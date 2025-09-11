import type {ReplayFrame} from 'sentry/utils/replays/types';

export interface ReplayEmbeddedTableOptions {
  currentHoverTime?: number;
  currentTime?: number;
  displayReplayTimeIndicator?: boolean;
  frames?: ReplayFrame[];
  inReplay?: boolean;
  onReplayTimeClick?: (offsetMs: string) => void;
  openWithExpandedIds?: string[];
  timestampRelativeTo?: number;
}
