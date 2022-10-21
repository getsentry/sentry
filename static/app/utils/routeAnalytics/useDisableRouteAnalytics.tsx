import {useRouteAnalytics} from './useRouteAnalytics';

/**
 * Disables route analytics when called in a component.
 * Must be called within 2s after the organization context is loaded.
 */
export default function useDisableRouteAnalytics() {
  useRouteAnalytics().setDisableRouteAnalytics();
}
