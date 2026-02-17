/**
 * Intercom Messenger utilities.
 *
 * Intercom is only loaded in SaaS environments when the feature flag is enabled.
 * These functions will operate as no-ops otherwise.
 */

declare global {
  interface Window {
    Intercom?: (command: string, ...args: unknown[]) => void;
  }
}

export interface IntercomUserData {
  createdAt: number;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  userId: string;
}

/**
 * Boot Intercom with user identity verification.
 *
 * @param appId - The Intercom app ID
 * @param userJwt - JWT for identity verification (signed with HS256)
 * @param userData - User data to pass to Intercom
 */
export function bootIntercom(
  appId: string,
  userJwt: string,
  userData: IntercomUserData
): void {
  if (!hasIntercom()) {
    return;
  }

  window.Intercom!('boot', {
    app_id: appId,
    user_hash: userJwt,
    user_id: userData.userId,
    email: userData.email,
    name: userData.name,
    created_at: userData.createdAt,
    company: {
      company_id: userData.organizationId,
      name: userData.organizationName,
    },
  });
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
  if (!hasIntercom()) {
    return;
  }

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

  window.Intercom!('update', updateData);
}

/**
 * Shutdown Intercom session.
 * Call this when the user logs out to clear the session cookie.
 */
export function shutdownIntercom(): void {
  if (!hasIntercom()) {
    return;
  }

  window.Intercom!('shutdown');
}

/**
 * Show the Intercom Messenger.
 */
export function showIntercom(): void {
  if (!hasIntercom()) {
    return;
  }

  window.Intercom!('show');
}

/**
 * Hide the Intercom Messenger.
 */
export function hideIntercom(): void {
  if (!hasIntercom()) {
    return;
  }

  window.Intercom!('hide');
}

/**
 * Check if Intercom is available.
 */
export function hasIntercom(): boolean {
  return typeof window.Intercom === 'function';
}

/**
 * Check if Intercom is fully loaded and operational.
 * Use this to verify the widget is responsive before activating.
 */
export function intercomIsLoaded(): boolean {
  return hasIntercom();
}
