import type {OnChangeHandlerFunc} from 'react-mentions';

import type {DEFAULT_ERROR_JSON} from 'sentry/constants';

/**
 * List of id, display name
 */
export type Mentioned = [id: string, display: string];

/**
 * The typings for the react-mentionables library use this type
 * for their change event so we also use it.
 */
export type MentionChangeEvent = Parameters<OnChangeHandlerFunc>[0];

export type CreateError =
  | {
      detail: {
        code: number;
        extra: any;
        message: string;
      };
    }
  | typeof DEFAULT_ERROR_JSON;
