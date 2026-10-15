import type {MarkedToken} from '../marked';

import type {TagToken} from './tag';
import {blockTagExtension, inlineTagExtension} from './tag';

export const extensions = [blockTagExtension, inlineTagExtension];
export type ExtendedToken = MarkedToken | TagToken;
