import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';

export interface SeerCreditUsageMeterProps {
  /**
   * The surface's own credit check: whether the organization can afford the
   * operation the meter sits next to. The meter warns when it can't.
   */
  hasEnoughCredits: boolean;
}

/**
 * How much of its Seer credits the organization has used, shown next to a
 * billable trigger such as the chat's send button. Hovering explains the
 * balance and how credits reload.
 *
 * getsentry supplies the implementation, since it owns the credit wallet and
 * the auto-reload settings. Open source has no credits and renders nothing.
 */
export const SeerCreditUsageMeter = OverrideOrDefault({
  overrideName: 'component:seer-credit-usage-meter',
});
