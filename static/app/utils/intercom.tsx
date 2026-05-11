/**
 * Intercom Messenger utilities.
 *
 * Uses the official @intercom/messenger-js-sdk for React integration.
 * Intercom is lazily initialized on first "Contact Support" click.
 */

import {Client} from 'sentry/api';
import {ConfigStore} from 'sentry/stores/configStore';

interface IntercomUserData {
  createdAt: number;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  userId: string;
}

interface IntercomJwtResponse {
  jwt: string;
  userData: IntercomUserData;
}

let hasBooted = false;
let bootPromise: Promise<void> | null = null;
let bootedOrgSlug: string | null = null;

/**
 * Initialize Intercom with identity verification.
 * Only fetches JWT and boots on first call.
 */
async function initIntercom(orgSlug: string): Promise<void> {
  if (hasBooted) {
    return;
  }

  // Prevent concurrent initialization
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    try {
      const intercomAppId = ConfigStore.get('intercomAppId');
      if (!intercomAppId) {
        throw new Error('Intercom app ID not configured');
      }

      // Fetch JWT for identity verification
      const api = new Client();
      const jwtData: IntercomJwtResponse = await api.requestPromise(
        `/organizations/${orgSlug}/intercom-jwt/`
      );

      // Boot Intercom with user data
      const {default: Intercom} = await import('@intercom/messenger-js-sdk');
      Intercom({
        app_id: intercomAppId,
        user_id: jwtData.userData.userId,
        user_hash: jwtData.jwt,
        email: jwtData.userData.email,
        name: jwtData.userData.name,
        created_at: jwtData.userData.createdAt,
        company: {
          company_id: jwtData.userData.organizationId,
          name: jwtData.userData.organizationName,
        },
        hide_default_launcher: true,
      });

      hasBooted = true;
      bootedOrgSlug = orgSlug;
    } catch (error) {
      // Reset so user can retry on next click
      bootPromise = null;
      throw error;
    }
  })();

  return bootPromise;
}

/**
 * Shutdown Intercom and clear session data.
 * Call this when user logs out or switches organizations.
 */
export async function shutdownIntercom(): Promise<void> {
  if (!hasBooted) {
    return;
  }

  const {shutdown} = await import('@intercom/messenger-js-sdk');
  shutdown();

  hasBooted = false;
  bootPromise = null;
  bootedOrgSlug = null;
}

/**
 * Show the Intercom Messenger.
 * Lazily initializes Intercom on first call.
 * If already booted for a different org, shuts down first and re-initializes.
 */
export async function showIntercom(orgSlug: string): Promise<void> {
  // If booted for a different org, shutdown first to re-initialize with new org context
  if (hasBooted && bootedOrgSlug !== orgSlug) {
    await shutdownIntercom();
  }

  await initIntercom(orgSlug);
  const {show} = await import('@intercom/messenger-js-sdk');
  show();
}
