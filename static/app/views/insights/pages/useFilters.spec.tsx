import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

const frontendBasePath = `/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}`;
const backendBasePath = `/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}`;

describe('useDomainViewFilters', () => {
  it('should return correct domain view based on the url', () => {
    const {result} = renderHookWithProviders(useDomainViewFilters, {
      initialRouterConfig: {location: {pathname: frontendBasePath}},
    });
    const {isInDomainView, view} = result.current;

    expect(isInDomainView).toBe(true);
    expect(view).toBe(FRONTEND_LANDING_SUB_PATH);
  });

  it('should return correct domain view if in nested url', () => {
    const {result} = renderHookWithProviders(useDomainViewFilters, {
      initialRouterConfig: {location: {pathname: `${backendBasePath}/http/`}},
    });
    const {isInDomainView, view} = result.current;

    expect(isInDomainView).toBe(true);
    expect(view).toBe(BACKEND_LANDING_SUB_PATH);
  });

  it('should not return isInDomainView if not in domain view', () => {
    const {result} = renderHookWithProviders(useDomainViewFilters, {
      initialRouterConfig: {location: {pathname: '/performance/'}},
    });
    const {isInDomainView, view} = result.current;

    expect(isInDomainView).toBe(false);
    expect(view).toBeUndefined();
  });
});
