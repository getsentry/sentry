import {Sparklines as BaseSparklines} from 'react-sparklines';

/**
 * This is required because:
 *
 * - React.Suspense only works with default exports
 */
export class Sparklines extends BaseSparklines {}
