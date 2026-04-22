export function trackPendoEvent(eventName: string, data: Record<PropertyKey, unknown>) {
  // make sure we have the tracking function
  if (typeof globalThis.pendo?.track !== 'function') {
    return;
  }
  // TODO: force all data to lower case field properties
  globalThis.pendo.track(eventName, data);
}
