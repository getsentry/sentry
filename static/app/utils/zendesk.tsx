/**
 * Activates the Zendesk widget.
 *
 * Zendesk script is only loaded in SaaS. This will operate as a noop otherwise.
 */
export async function activateZendesk() {
  if (await zendeskIsLoaded()) {
    window.zE.activate({hideOnClose: true});
  }
}

/**
 * Check that zendesk widget is available. Use zendeskIsLoaded to ensure the
 * widget is correctly loaded.
 */
export function hasZendesk() {
  return window.zE && typeof window.zE.activate === 'function';
}

/**
 * Determines if the zendesk widget is loaded and not blocked by web browser
 * configurations (such as Firefox's Strict Mode)
 */
export async function zendeskIsLoaded() {
  if (!window.zE || typeof window.zE.activate !== 'function') {
    return false;
  }

  // Ensure the zendesk widget configuration can be loaded
  try {
    await fetch('https://sentry.zendesk.com/embeddable/config');
    return true;
  } catch {
    return false;
  }
}
