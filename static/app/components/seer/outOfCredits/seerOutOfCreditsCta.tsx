import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';

export interface SeerOutOfCreditsCtaProps {
  /**
   * Replaces the default headline, for example to say a run stopped part way.
   */
  message?: React.ReactNode;
}

/**
 * Tells the viewer their organization is out of Seer credits and offers the
 * one thing they can do about it: top up, request credits, or nothing when
 * the org can't self-serve.
 *
 * getsentry supplies the implementation, since it knows the viewer's billing
 * access and the org's plan. Open source has no credits and renders nothing.
 */
export const SeerOutOfCreditsCta = OverrideOrDefault({
  overrideName: 'component:seer-out-of-credits-cta',
});
