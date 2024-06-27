import useMedia from 'sentry/utils/useMedia';

export function usePrefersReducedMotion() {
  return !useMedia('(prefers-reduced-motion: no-preference)');
}
