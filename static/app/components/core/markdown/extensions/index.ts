import type {MarkedToken} from '@sentry/scraps/markdown/marked';

import type {AnnotationToken} from './annotation';
import {annotationExtension} from './annotation';
import type {TagToken} from './tag';
import {blockTagExtension, inlineTagExtension} from './tag';

export const extensions = [blockTagExtension, inlineTagExtension, annotationExtension];
export type ExtendedToken = MarkedToken | TagToken | AnnotationToken;
