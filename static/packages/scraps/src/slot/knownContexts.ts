import {ContainerQueryContext} from '@sentry/scraps/layout/styles';
import {SizeContext} from '@sentry/scraps/sizeContext';

export const KNOWN_BRIDGED_CONTEXTS = [SizeContext, ContainerQueryContext] as const;
