import type {EventMessage} from 'sentry/serviceWorker/types';

export function handleInboundEvent(
  _sw: ServiceWorkerGlobalScope,
  message: EventMessage
): void | Promise<void> {
  switch (message.name) {
    case 'ping':
      // eslint-disable-next-line no-console
      return console.log('pong!');
    default:
      return;
  }
}
