import makeAnalyticsFunction from './makeAnalyticsFunction';
/**
 * This file defines events that are not tied to a specific organization
 */

// define the event key to payload mappings
type UserOnlyAnalyticsEventParamaters = {
  'growth.demo_click_docs': {};
  'growth.demo_click_get_started': {cta?: string};
  'growth.demo_click_request_demo': {};
};

type UserOnlyAnalyticsEventKeys = keyof UserOnlyAnalyticsEventParamaters;

const userOnlyEventMap: Record<UserOnlyAnalyticsEventKeys, string | null> = {
  'growth.demo_click_get_started': 'Growth: Demo Click Get Started',
  'growth.demo_click_docs': 'Growth: Demo Click Docs',
  'growth.demo_click_request_demo': 'Growth: Demo Click Request Demo',
};

const trackUserOnlyAnalyticsEvents = makeAnalyticsFunction<
  UserOnlyAnalyticsEventParamaters,
  {organization: null} // no org
>(userOnlyEventMap);

export default trackUserOnlyAnalyticsEvents;
