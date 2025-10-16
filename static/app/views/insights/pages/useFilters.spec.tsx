import {LocationFixture} from 'sentry-fixture/locationFixture';

import {useLocation} from 'sentry/utils/useLocation';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

const frontendBasePath = `/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}`;
const backendBasePath = `/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}`;

describe('useDomainViewFilters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseLocation.mockReturnValue(
      LocationFixture({pathname: `/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}`})
    );
  });

  it('should return correct domain view based on the url', () => {
    mockUseLocation.mockReturnValue(LocationFixture({pathname: frontendBasePath}));
    const {isInDomainView, view} = useDomainViewFilters();
    expect(isInDomainView).toBe(true);
    expect(view).toBe(FRONTEND_LANDING_SUB_PATH);
  });

  it('should return correct domain view if in nested url', () => {
    mockUseLocation.mockReturnValue(
      LocationFixture({pathname: `${backendBasePath}/http/`})
    );
    const {isInDomainView, view} = useDomainViewFilters();
    expect(isInDomainView).toBe(true);
    expect(view).toBe(BACKEND_LANDING_SUB_PATH);
  });

  it('should not return isInDomainView if not in domain view', () => {
    mockUseLocation.mockReturnValue(LocationFixture({pathname: '/performance/'}));
    const {isInDomainView, view} = useDomainViewFilters();
    expect(isInDomainView).toBe(false);
    expect(view).toBeUndefined();
  });
});
