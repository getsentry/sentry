/* global process */

type PoseConfig = {[key: string]: any};

/**
 * Use with a react-pose animation to disable the animation in testing
 * environments.
 *
 * This function simply sets delays and durations to 0.
 */
const testablePose = !process.env.IS_PERCY
  ? (a: PoseConfig) => a
  : function(animation: PoseConfig) {
      Object.keys(animation).forEach(pose => {
        animation[pose].delay = 0;
        animation[pose].delayChildren = 0;
        animation[pose].staggerChildren = 0;

        animation[pose].transition = {duration: 0};
      });

      return animation;
    };

export default testablePose;
