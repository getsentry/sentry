import {getCurrentHub} from '@sentry/react';
import {DsnComponents} from '@sentry/types';

import {prepareFeedbackEvent} from './prepareFeedbackEvent';

/**
 * Function taken from sentry-javascript
 */
function dsnToString(dsn: DsnComponents, withPassword: boolean = false): string {
  const {host, path, pass, port, projectId, protocol, publicKey} = dsn;
  return (
    `${protocol}://${publicKey}${withPassword && pass ? `:${pass}` : ''}` +
    `@${host}${port ? `:${port}` : ''}/${path ? `${path}/` : path}${projectId}`
  );
}

/**
 * Send feedback using `fetch()`
 */
export async function sendFeedbackRequest({
  feedback: {message, email, name, replay_id, url},
  tags,
}): Promise<Response | null> {
  const hub = getCurrentHub();

  if (!hub) {
    return null;
  }

  const client = hub.getClient();
  const scope = hub.getScope();
  const transport = client && client.getTransport();
  const dsn = client && client.getDsn();

  if (!client || !transport || !dsn) {
    return null;
  }

  const baseEvent = {
    feedback: {
      contact_email: email,
      name,
      message,
      replay_id,
      url,
    },
    tags,
    // type: 'feedback_event',
  };

  const feedbackEvent = await prepareFeedbackEvent({
    scope,
    client,
    event: baseEvent,
  });

  if (!feedbackEvent) {
    return null;
  }

  // Prevent this data (which, if it exists, was used in earlier steps in the processing pipeline) from being sent to
  // sentry. (Note: Our use of this property comes and goes with whatever we might be debugging, whatever hacks we may
  // have temporarily added, etc. Even if we don't happen to be using it at some point in the future, let's not get rid
  // of this `delete`, lest we miss putting it back in the next time the property is in use.)
  delete feedbackEvent.sdkProcessingMetadata;

  try {
    const path = 'https://sentry.io/api/0/feedback/';
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `DSN ${dsnToString(dsn)}`,
      },
      body: JSON.stringify(feedbackEvent),
    });
    if (!response.ok) {
      return null;
    }
    return response;
  } catch (err) {
    return null;
  }
}
