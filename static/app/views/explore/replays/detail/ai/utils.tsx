import {t} from 'sentry/locale';

export const NO_REPLAY_SUMMARY_MESSAGES = [
  t('Quiet moment here — nothing too wild happening in this replay.'),
  t('Looks like a peaceful little replay!'),
  t('Just a calm moment in the timeline.'),
  t('This replay is taking it easy.'),
  t('Not a lot happening here — maybe a coffee break?'),
  t('All quiet on the replay front.'),
];

export const REPLAY_SUMMARY_PROCESSING_MESSAGES = [
  t('Reconstructing session timeline from Replay events...'),
  t('Gathering logs, navigation, and network metadata...'),
  t('Applying privacy settings...'),
  t('Analyzing Replay stream...'),
  t('Highlighting key moments: errors, long waits, and rage clicks...'),
  t('Turning signals into a readable summary...'),
  t('Sanity-checking the summary against the Replay timeline...'),
  t('Finalizing, almost ready...'),
  t('Still working — this Replay has a lot going on...'),
];

export enum ReplaySummaryStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
  NOT_STARTED = 'not_started',
}

export enum ReplaySummaryTemp {
  MIN = 0,
  LOW = 0.2,
  MED = 0.5,
  HIGH = 0.8,
  MAX = 1,
}

export interface SummaryResponse {
  created_at: string | null;
  data: {
    summary: string;
    time_ranges: TimeRanges;
  } | null;
  num_segments: number | null;
  status: ReplaySummaryStatus;
}

export type TimeRanges = Array<{
  period_end: number;
  period_start: number;
  period_title: string;
}>;

/**
 * Returns the index of the one chapter that owns `timestampMs`, or -1.
 *
 * Chapters must be sorted by `start`. Ranges are half-open (`[start, end)`) so a
 * timestamp on a shared boundary belongs only to the later chapter. A chapter
 * still owns its `end` when no later chapter starts there (the last chapter, or
 * a gap before the next one), and a zero-length chapter owns its single instant.
 * The first chapter owns anything before its start, because summaries can begin
 * a few ms after the first event of the replay. When ranges overlap, the earlier
 * chapter wins.
 */
export function findChapterIndex(
  chapters: ReadonlyArray<{end: number; start: number}>,
  timestampMs: number
): number {
  return chapters.findIndex(({start, end}, i) => {
    if (timestampMs < start) {
      return i === 0;
    }
    if (timestampMs !== end) {
      return timestampMs < end;
    }
    const next = chapters[i + 1];
    return start === end || next === undefined || next.start > end;
  });
}
