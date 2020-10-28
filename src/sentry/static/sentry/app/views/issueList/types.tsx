import {TagValue} from 'app/types';

export type TagValueLoader = (key: string, search: string) => Promise<TagValue[]>;
