/**
 * Intercom Messenger utilities.
 *
 * Uses the official @intercom/messenger-js-sdk for React integration.
 * Intercom is only loaded in SaaS environments when the feature flag is enabled.
 */

import {show} from '@intercom/messenger-js-sdk';

export interface IntercomUserData {
  createdAt: number;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  userId: string;
}

/**
 * Show the Intercom Messenger.
 */
export function showIntercom(): void {
  show();
}
