import type {MotionProps, Variants} from 'framer-motion';

/**
 * One timing for the whole onboarding flow. Entries are quick and small: a
 * block fades up a few pixels, and siblings follow each other closely enough to
 * read as one movement rather than a sequence of slides.
 */
/** Every constant here defines its variants, so callers can read them directly. */
type OnboardingMotion = MotionProps & {variants: Variants};

const DURATION = 0.2;
const STAGGER = 0.07;
const DISTANCE = 4;

/**
 * Put on whatever holds a set of things that should enter one after another: a
 * step, a heading block, a footer. Declares the variant names, so children only
 * need `ONBOARDING_ENTER`.
 */
export const ONBOARDING_STAGGER: OnboardingMotion = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    animate: {transition: {staggerChildren: STAGGER}},
  },
};

/**
 * @public Consumed by the SCM onboarding connect step (#125255).
 *
 * Put on a list whose items should enter one after another. The list itself
 * does not move, so an item's own entry is the only thing on screen.
 */
export const ONBOARDING_STAGGER_CHILDREN: OnboardingMotion = {
  variants: {
    initial: {},
    animate: {transition: {staggerChildren: STAGGER}},
    exit: {},
  },
};

/**
 * Put on each thing that enters: a section, a paragraph, a card. Meant to sit
 * inside an `ONBOARDING_STAGGER` container, which drives the timing.
 */
export const ONBOARDING_ENTER: OnboardingMotion = {
  variants: {
    initial: {opacity: 0, y: DISTANCE},
    animate: {opacity: 1, y: 0, transition: {duration: DURATION, ease: 'easeOut'}},
    exit: {opacity: 0, transition: {duration: DURATION / 2}},
  },
};
