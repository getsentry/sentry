import {FeedbackItemResponse, HydratedFeedbackItem} from 'sentry/utils/feedback/types';

export default function hydrateFeedbackRecord(
  apiResponse: FeedbackItemResponse
): HydratedFeedbackItem {
  const unorderedTags: HydratedFeedbackItem['tags'] = {
    ...apiResponse.tags,
    ...(apiResponse.browser.name ? {'browser.name': apiResponse.browser.name} : {}),
    ...(apiResponse.browser.version
      ? {'browser.version': apiResponse.browser.version}
      : {}),
    ...(apiResponse.device.brand ? {'device.brand': apiResponse.device.brand} : {}),
    ...(apiResponse.device.family ? {'device.family': apiResponse.device.family} : {}),
    ...(apiResponse.device.model ? {'device.model': apiResponse.device.model} : {}),
    ...(apiResponse.device.name ? {'device.name': apiResponse.device.name} : {}),
    ...(apiResponse.locale.lang ? {'locale.lang': apiResponse.locale.lang} : {}),
    ...(apiResponse.locale.timezone
      ? {'locale.timezone': apiResponse.locale.timezone}
      : {}),
    ...(apiResponse.os.name ? {'os.name': apiResponse.os.name} : {}),
    ...(apiResponse.os.version ? {'os.version': apiResponse.os.version} : {}),
    ...(apiResponse.platform ? {platform: apiResponse.platform} : {}),
    ...(apiResponse.sdk.name ? {'sdk.name': apiResponse.sdk.name} : {}),
    ...(apiResponse.sdk.version ? {'sdk.version': apiResponse.sdk.version} : {}),
  };

  // Sort the tags by key
  const tags = Object.keys(unorderedTags)
    .sort()
    .reduce((acc, key) => {
      acc[key] = unorderedTags[key];
      return acc;
    }, {});

  return {
    ...apiResponse,
    feedback_id: apiResponse.feedback_id,
    timestamp: new Date(apiResponse.timestamp),
    tags,
  };
}
