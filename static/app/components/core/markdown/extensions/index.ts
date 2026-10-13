import type {MarkedToken} from '@sentry/scraps/markdown/marked';

import type {TagToken} from './tag';
import {blockTagExtension, inlineTagExtension} from './tag';

export const extensions = [blockTagExtension, inlineTagExtension];
export type ExtendedToken = MarkedToken | TagToken;
