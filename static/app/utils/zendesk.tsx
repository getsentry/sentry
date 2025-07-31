/**
 * Activates the Zendesk widget.
 *
 * Zendesk script is only loaded in SaaS. This will operate as a noop otherwise.
 */
export function activateZendesk() {
  if (zendeskIsLoaded()) {
    window.zE.activate({hideOnClose: true});
  }
}

export function zendeskIsLoaded() {
  return window.zE && typeof window.zE.activate === 'function';
}
