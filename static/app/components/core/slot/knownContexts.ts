import {LayerContext} from '@sentry/scraps/layer';
import {SizeContext} from '@sentry/scraps/sizeContext';

export const KNOWN_BRIDGED_CONTEXTS = [LayerContext, SizeContext] as const;
