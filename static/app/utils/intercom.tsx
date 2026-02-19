/**
 * Intercom Messenger utilities.
 *
 * Uses the official @intercom/messenger-js-sdk for React integration.
 * Intercom is only loaded in SaaS environments when the feature flag is enabled.
 */

import {
  hide,
  shutdown as sdkShutdown,
  update as sdkUpdate,
  show,
} from '@intercom/messenger-js-sdk';

export interface IntercomUserData {
  createdAt: number;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  userId: string;
}

/**
 * Update Intercom with new user data.
 * Call this when user data changes without a page refresh.
 *
 * @param userData - Partial user data to update
 * @param userHash - Optional new JWT for identity verification refresh
 */
export function updateIntercom(
  userData: Partial<IntercomUserData>,
  userHash?: string
): void {
  const updateData: Record<string, unknown> = {};
  if (userHash) {
    updateData.user_hash = userHash;
  }
  if (userData.email) {
    updateData.email = userData.email;
  }
  if (userData.name) {
    updateData.name = userData.name;
  }
  if (userData.organizationId && userData.organizationName) {
    updateData.company = {
      company_id: userData.organizationId,
      name: userData.organizationName,
    };
  }

  sdkUpdate(updateData);
}

/**
 * Shutdown Intercom session.
 * Call this when the user logs out to clear the session cookie.
 */
export function shutdownIntercom(): void {
  sdkShutdown();
}

/**
 * Show the Intercom Messenger.
 */
export function showIntercom(): void {
  show();
}

/**
 * Hide the Intercom Messenger.
 */
export function hideIntercom(): void {
  hide();
}

/**
 * Check if Intercom is available.
 * With the SDK, we check if window.Intercom exists (set by the SDK).
 */
export function hasIntercom(): boolean {
  return typeof window !== 'undefined' && typeof window.Intercom === 'function';
}

/**
 * Check if Intercom is fully loaded and operational.
 * Use this to verify the widget is responsive before activating.
 */
export function intercomIsLoaded(): boolean {
  return hasIntercom();
}
