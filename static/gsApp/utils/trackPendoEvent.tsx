export default function trackPendoEvent(
  eventName: string,
  data: Record<PropertyKey, unknown>
) {
  // make sure we have the tracking function
  if (typeof window.pendo?.track !== 'function') {
    return;
  }
  // TODO: force all data to lower case field properties
  window.pendo.track(eventName, data);
}
