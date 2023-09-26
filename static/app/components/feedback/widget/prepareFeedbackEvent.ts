import type {Scope} from '@sentry/core';
import {prepareEvent} from '@sentry/core';
import type {Client} from '@sentry/types';

import type {FeedbackEvent} from './types';

/**
 * Prepare a feedback event & enrich it with the SDK metadata.
 */
export async function prepareFeedbackEvent({
  client,
  scope,
  event,
}: {
  client: Client;
  event: FeedbackEvent;
  scope: Scope;
}): Promise<FeedbackEvent | null> {
  const preparedEvent = (await prepareEvent(
    client.getOptions(),
    event,
    {integrations: []},
    scope
  )) as FeedbackEvent | null;

  // If e.g. a global event processor returned null
  if (!preparedEvent) {
    return null;
  }

  // This normally happens in browser client "_prepareEvent"
  // but since we do not use this private method from the client, but rather the plain import
  // we need to do this manually.
  preparedEvent.platform = preparedEvent.platform || 'javascript';

  // extract the SDK name because `client._prepareEvent` doesn't add it to the event
  const metadata = client.getSdkMetadata && client.getSdkMetadata();
  const {name, version} = (metadata && metadata.sdk) || {};

  preparedEvent.sdk = {
    ...preparedEvent.sdk,
    name: name || 'sentry.javascript.unknown',
    version: version || '0.0.0',
  };
  return preparedEvent;
}
