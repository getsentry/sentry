import {Event} from 'sentry/types/event';

import {Context} from '.';

function filterContexts(event: Event, context: Context) {
  // if the operating system is macOS, we want to hide devices called "Mac" which don't have any additional info
  if (context.keys.includes('device')) {
    const {model, arch} = event.contexts?.device || {};
    const {name: os} = event.contexts?.os || event.contexts?.client_os || {};

    if (model === 'Mac' && !arch && os?.toLowerCase().includes('mac')) {
      return false;
    }
  }

  // do not show the context summary if only runtime raw_description is defined (without name or version)
  if (context.keys.includes('runtime')) {
    if (
      event.contexts.runtime?.raw_description &&
      !(event.contexts.runtime?.name || event.contexts.runtime?.version)
    ) {
      return false;
    }
  }

  return true;
}

export default filterContexts;
