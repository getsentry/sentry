import {Event} from 'sentry/types';

export default function hydrateEventTags(
  eventData: Event | undefined
): Record<string, string> {
  if (!eventData || !eventData.contexts) {
    return {};
  }
  const context = eventData.contexts;
  const eventTags = eventData.tags;

  const unorderedTags = {
    ...(context.browser?.name ? {'browser.name': context.browser.name} : {}),
    ...(context.browser?.version ? {'browser.version': context.browser.version} : {}),
    ...(context.device?.brand ? {'device.brand': context.device?.brand} : {}),
    ...(context.device?.family ? {'device.family': context.device?.family} : {}),
    ...(context.device?.model ? {'device.model': context.device?.model} : {}),
    ...(context.device?.name ? {'device.name': context.device?.name} : {}),
    ...(context.os?.name ? {'os.name': context.os?.name} : {}),
    ...(context.os?.version ? {'os.version': context.os?.version} : {}),
    ...(eventTags.find(e => e.key === 'environment')
      ? {environment: eventTags.find(e => e.key === 'environment')?.value}
      : {}),
    ...(eventTags.find(e => e.key === 'transaction')
      ? {transaction: eventTags.find(e => e.key === 'transaction')?.value}
      : {}),
    ...(eventData.platform ? {platform: eventData.platform} : {}),
    ...(eventData.sdk?.name ? {'sdk.name': eventData.sdk?.name} : {}),
    ...(eventData.sdk?.version ? {'sdk.version': eventData.sdk?.version} : {}),
  };

  // Sort the tags by key
  const tags: Record<string, string> = Object.keys(unorderedTags)
    .sort()
    .reduce((acc, key) => {
      acc[key] = unorderedTags[key];
      return acc;
    }, {});

  return tags;
}
