import type {AnnotationToken} from '@sentry/scraps/markdown/annotation';
import {annotationExtension} from '@sentry/scraps/markdown/annotation';
import type {MarkedToken} from '@sentry/scraps/markdown/marked';

import type {TagToken} from './tag';
import {blockTagExtension, inlineTagExtension} from './tag';

export const extensions = [blockTagExtension, inlineTagExtension, annotationExtension];
export type ExtendedToken = MarkedToken | TagToken | AnnotationToken;
