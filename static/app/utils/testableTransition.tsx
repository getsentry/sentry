import type {Transition} from 'framer-motion';

/**
 * Use with a framer-motion transition (previously disabled animations in testing environments).
 *
 * If your animation has no transition you can simply specify
 *
 * ```tsx
 * Component.defaultProps = {
 *   transition: testableTransition(),
 * }
 * ```
 */
const testableTransition = (t?: Transition) => t;

export default testableTransition;
