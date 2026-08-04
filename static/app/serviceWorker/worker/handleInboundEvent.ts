import type {EventMessage} from 'sentry/serviceWorker/types';
import {handleAutofixStartStep} from 'sentry/serviceWorker/worker/handleAutofixStartStep';

export function handleInboundEvent(
  sw: ServiceWorkerGlobalScope,
  message: EventMessage
): void | Promise<void> {
  switch (message.name) {
    case 'ping':
      // eslint-disable-next-line no-console
      return console.log('pong!');
    case 'autofix.startStep':
      return handleAutofixStartStep(sw, message.data);
    default:
      return;
  }
}
