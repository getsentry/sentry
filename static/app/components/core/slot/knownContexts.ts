import {LayerContext} from '@sentry/scraps/layer';
import {SizeContext} from '@sentry/scraps/sizeContext';

export const KNOWN_BRIDGED_CONTEXTS: Array<React.Context<any>> = [
  LayerContext,
  SizeContext,
];
