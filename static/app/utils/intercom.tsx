/**
 * Intercom Messenger utilities.
 *
 * Uses the official @intercom/messenger-js-sdk for React integration.
 * Intercom is lazily initialized on first "Contact Support" click.
 */

import type {boot as intercomBoot} from '@intercom/messenger-js-sdk';

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

type IntercomSettings = Parameters<typeof intercomBoot>[0];

let bootPromise: Promise<void> | null = null;
let intercomState: {orgSlug: string; settings: IntercomSettings} | null = null;

function removeIntercomCookies(): void {
  const cookieNames = document.cookie
    .split(';')
    .map(cookie => cookie.trim().split('=')[0])
    .filter(cookieName => cookieName?.startsWith('intercom'));

  for (const cookieName of cookieNames) {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/; domain=.sentry.io`;
  }
}

/**
 * Initialize Intercom with identity verification.
 * Only fetches JWT and boots on first call.
 */
async function initIntercom(orgSlug: string): Promise<void> {
  if (intercomState) {
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

      const intercomSettings: IntercomSettings = {
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
      };

      // Intercom's session cookie is scoped to .sentry.io and survives the
      // hard navigation between org subdomains, so a plain boot resumes the
      // previous org's session. Load the SDK, drop stale Intercom cookies,
      // then boot clean with this org's identity.
      removeIntercomCookies();

      const {default: Intercom} = await import('@intercom/messenger-js-sdk');
      Intercom(intercomSettings);

      intercomState = {orgSlug, settings: intercomSettings};
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
 *
 * Used for logout and same-page (SPA) org switches. Customer-domain org
 * switches are hard navigations, so their cleanup happens after Messenger show.
 */
export async function shutdownIntercom(): Promise<void> {
  if (!intercomState) {
    return;
  }

  const {shutdown} = await import('@intercom/messenger-js-sdk');
  shutdown();

  bootPromise = null;
  intercomState = null;
}

/**
 * Show the Intercom Messenger.
 * Lazily initializes Intercom on first call.
 * If already booted for a different org, shuts down first and re-initializes.
 */
export async function showIntercom(orgSlug: string): Promise<void> {
  // If booted for a different org, shutdown first to re-initialize with new org context
  if (intercomState && intercomState.orgSlug !== orgSlug) {
    await shutdownIntercom();
  }

  await initIntercom(orgSlug);
  const {show} = await import('@intercom/messenger-js-sdk');
  show();
}
