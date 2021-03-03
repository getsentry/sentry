import {Event} from 'app/types/event';

import {Context} from './contextSummary';

function filterContexts(event: Event, context: Context) {
  // if the operating system is macOS, we want to hide devices called "Mac" which don't have any additional info
  if (context.keys.includes('device')) {
    const {model, arch} = event.contexts?.device || {};
    const {name: os} = event.contexts?.os || event.contexts?.client_os || {};

    if (model === 'Mac' && !arch && os?.toLowerCase().includes('mac')) {
      return false;
    }
  }

  return true;
}

export default filterContexts;
