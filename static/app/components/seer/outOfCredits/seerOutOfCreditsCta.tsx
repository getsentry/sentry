import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import type {SeerCreditDenialReason} from 'sentry/utils/seer/useSeerCreditCheck';

/**
 * What the organization can't afford, which picks the copy:
 *
 * - `agent-chat`: sending Seer a message.
 * - `autofix-start`: starting an Autofix run.
 * - `autofix-continue`: the next step of a run that already has results,
 *   including a run that stopped part way for credits.
 */
export type SeerOutOfCreditsReason = 'agent-chat' | 'autofix-start' | 'autofix-continue';

export interface SeerOutOfCreditsCtaProps {
  /**
   * Why the surface's credit check denied credit, which also picks the copy:
   * hitting the daily usage limit reads differently from running out.
   */
  denialReason: SeerCreditDenialReason | null;
  reason: SeerOutOfCreditsReason;
  /**
   * The action button's size. Defaults to `md` for `agent-chat`, which sits
   * above the chat's composer, and `sm` for Autofix's tighter spots.
   */
  size?: 'sm' | 'md';
  /**
   * `muted` is for tight spots where the gated button stays on screen,
   * disabled, under the notice, like the issue sidebar.
   */
  variant?: 'warning' | 'muted';
}

/**
 * Tells the viewer their organization is out of Seer credits and offers the
 * one thing they can do about it: configure auto-reload, email their admins, or
 * nothing when the org can't self-serve.
 *
 * getsentry supplies the implementation, since it knows the viewer's billing
 * access, the org's plan and its auto-reload settings. Open source has no
 * credits and renders nothing.
 */
export const SeerOutOfCreditsCta = OverrideOrDefault({
  overrideName: 'component:seer-out-of-credits-cta',
});
