import {getGlobalScope} from '@sentry/core';
import type {Integration} from '@sentry/types';
import {uuid4} from '@sentry/utils';

/**
 * This is a POC to test how/if we could enable a concept of tracing sessions (similarly to what replay does
 * by connecting sessions with a replay id). The main goal is to allow users viewing traces to visualize the next
 * or previous trace that was initiated by the user, which would help with debugging and navigation.
 *
 * Note: Unlike relay this doesnt rely on user input or dom mutations to detect idle states and just store a session
 * in session storage and expire it after 24h. For the purposes of the POC, this is probably fine, but we may
 * want a better approach that mimics the behavior of replay more closely.
 */

type Session = {
  id: string;
  started_at: number;
};

const TRACE_SESSION_STORAGE_KEY = 'traceSession';
// Afaik we cant patch a context value, so we'll use a different key to store this and avoid conflicts.
const TRACE_SESSION_SENTRY_CONTEXT_KEY = 'trace_session';

const EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours

function makeSession(): Session {
  return {
    id: uuid4(),
    started_at: Date.now(),
  };
}

function safeGetSessionFromStorage(): string | null {
  try {
    return window.sessionStorage.getItem(TRACE_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function tryParse(input: any): any {
  if (typeof input !== 'string') {
    return null;
  }
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function validateSessionSchema(input: any): input is Session {
  return (
    !!input &&
    'id' in input &&
    'started_at' in input &&
    typeof input.id === 'string' &&
    input.id.length > 0 &&
    typeof input.started_at === 'number' &&
    !isNaN(input.started_at) &&
    input.started_at > 0
  );
}

function sessionHasExpired(session: Session): boolean {
  return Date.now() - session.started_at > EXPIRY_MS;
}

export function getOrStartTracingSession(): Session {
  // This can throw if cookies are disabled or some privacy setting is overriding session storage.
  // If that happens, just treat sessions as ephemeral
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return makeSession();
  }

  const something = safeGetSessionFromStorage();
  const maybeSession = tryParse(something);

  // If there is garbage stored in the session, start a new one
  if (!validateSessionSchema(maybeSession)) {
    return makeSession();
  }

  // If the session has expired, start a new one
  if (sessionHasExpired(maybeSession)) {
    return makeSession();
  }

  return maybeSession;
}

export const TracingSessionIntegration: Integration = {
  name: 'SentrySessionIntegration',
  setup(_client) {
    const globalScope = getGlobalScope();
    globalScope.setContext(TRACE_SESSION_SENTRY_CONTEXT_KEY, getOrStartTracingSession());
  },
};
