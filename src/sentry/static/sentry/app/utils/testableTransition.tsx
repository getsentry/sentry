import {Transition} from 'framer-motion';

import {IS_CI} from 'app/constants';

/**
 * Use with a framer-motion transition to disable the animation in testing
 * environments.
 *
 * If your animation has no transition you can simply specify
 *
 * ```tsx
 * Component.defaultProps = {
 *   transition: testableTransition(),
 * }
 * ```
 *
 * This function simply disables the animation `type`.
 */
const testableTransition = !IS_CI
  ? (t?: Transition) => t
  : function (transition?: Transition): Transition {
      return {
        ...transition,
        delay: 0,
        staggerChildren: 0,
        type: false,
      };
    };

export default testableTransition;
