import type {EventMessage} from 'sentry/serviceWorker/types';
import {handleAutofixStartStep} from 'sentry/serviceWorker/worker/handleAutofixStartStep';
import {handleSeerExplorerSendMessage} from 'sentry/serviceWorker/worker/handleSeerExplorerSendMessage';

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
    case 'seerExplorer.sendMessage':
      return handleSeerExplorerSendMessage(sw, message.data);
    default:
      return;
  }
}
