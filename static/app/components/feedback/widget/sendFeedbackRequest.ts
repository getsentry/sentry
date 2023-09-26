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
  message,
  email,
  replay_id,
  url,
}): Promise<Response | null> {
  const hub = window.Sentry?.getCurrentHub();

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
      message,
      replay_id,
      url,
    },
    // type: 'feedback_event',
  };

  const feedbackEvent = await prepareFeedbackEvent({
    scope,
    client,
    event: baseEvent,
  });

  if (!feedbackEvent) {
    // Taken from baseclient's `_processEvent` method, where this is handled for errors/transactions
    // client.recordDroppedEvent('event_processor', 'feedback', baseEvent);
    return null;
  }

  //
  // For reference, the fully built event looks something like this:
  // {
  // "data": {
  //     "dist": "abc123",
  //     "environment": "production",
  //     "feedback": {
  //       "contact_email": "colton.allen@sentry.io",
  //       "message": "I really like this user-feedback feature!",
  //       "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
  //       "url": "https://docs.sentry.io/platforms/javascript/"
  //     },
  //     "id": "1ffe0775ac0f4417aed9de36d9f6f8dc",
  //     "platform": "javascript",
  //     "release": "version@1.3",
  //     "request": {
  //       "headers": {
  //         "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
  //       }
  //     },
  //     "sdk": {
  //       "name": "sentry.javascript.react",
  //       "version": "6.18.1"
  //     },
  //     "tags": {
  //       "key": "value"
  //     },
  //     "timestamp": "2023-08-31T14:10:34.954048",
  //     "user": {
  //       "email": "username@example.com",
  //       "id": "123",
  //       "ip_address": "127.0.0.1",
  //       "name": "user",
  //       "username": "user2270129"
  //     }
  // }
  // }
  //

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
