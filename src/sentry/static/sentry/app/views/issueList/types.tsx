import {TagValue} from 'app/types';

export type TagValueLoader = (
  key: string,
  search: string,
  projectIds?: string[]
) => Promise<TagValue[]>;
