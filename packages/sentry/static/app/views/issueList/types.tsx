import {TagValue} from 'sentry/types';

export type TagValueLoader = (key: string, search: string) => Promise<TagValue[]>;
