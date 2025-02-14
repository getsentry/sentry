import type {ReleaseMetaBasic} from 'sentry/types/release';

export type Bucket = [
  start: number,
  placeholder: number,
  end: number,
  numReleases: number,
  releases: ReleaseMetaBasic[],
];
