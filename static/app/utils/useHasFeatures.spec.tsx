import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useHasFeatures} from 'sentry/utils/useHasFeatures';
import useOrganization from 'sentry/utils/useOrganization';

jest.mock('sentry/utils/useOrganization');

const mockUseOrganization = jest.mocked(useOrganization);

describe('useHasFeatures', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseOrganization.mockReturnValue(
      OrganizationFixture({features: ['feature1', 'feature2']})
    );
  });
  it('returns true if all features are enabled', () => {
    const {result} = renderHook(() => useHasFeatures(['feature1', 'feature2']));
    expect(result.current).toBe(true);
  });
  it('returns false if any feature is disabled', () => {
    const {result} = renderHook(() => useHasFeatures(['feature1', 'feature3']));
    expect(result.current).toBe(false);
  });
});
