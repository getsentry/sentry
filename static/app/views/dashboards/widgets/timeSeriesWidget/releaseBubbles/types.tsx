import type {ReleaseMetaBasic} from 'sentry/types/release';

export type Bucket = {
  end: number;
  releases: ReleaseMetaBasic[];
  start: number;
};
