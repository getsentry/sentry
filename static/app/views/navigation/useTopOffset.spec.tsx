import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {
  NAVIGATION_MOBILE_CONTENT_HEIGHT,
  SUPERUSER_MARQUEE_HEIGHT,
} from 'sentry/views/navigation/constants';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

jest.mock('sentry/utils/isActiveSuperuser', () => ({
  isActiveSuperuser: jest.fn(),
}));

// jsdom doesn't match the desktop media query, so the mobile header height applies.
const HEADER_HEIGHT = NAVIGATION_MOBILE_CONTENT_HEIGHT;

describe('useTopOffset', () => {
  beforeEach(() => {
    jest.mocked(isActiveSuperuser).mockReturnValue(true);
  });

  it('offsets the TopBar and in-page stickies by the superuser marquee when the window scrolls', () => {
    const {result} = renderHookWithProviders(useTopOffset, {
      organization: OrganizationFixture(),
    });

    expect(result.current.barTop).toBe(`${SUPERUSER_MARQUEE_HEIGHT}px`);
    expect(result.current.topBarTop).toBe(`${SUPERUSER_MARQUEE_HEIGHT}px`);
    expect(result.current.pageContentTop).toBe(
      `${SUPERUSER_MARQUEE_HEIGHT + HEADER_HEIGHT}px`
    );
  });

  it('does not offset the TopBar when the Seer Explorer sidebar pane is the scroller', () => {
    const {result} = renderHookWithProviders(useTopOffset, {
      organization: OrganizationFixture({
        openMembership: true,
        features: ['seer-explorer', 'seer-explorer-persistent-sidebar'],
      }),
    });

    expect(result.current.barTop).toBe(`${SUPERUSER_MARQUEE_HEIGHT}px`);
    expect(result.current.topBarTop).toBe('0px');
    expect(result.current.pageContentTop).toBe(`${HEADER_HEIGHT}px`);
  });

  it('has no marquee offset for non-superusers', () => {
    jest.mocked(isActiveSuperuser).mockReturnValue(false);

    const {result} = renderHookWithProviders(useTopOffset, {
      organization: OrganizationFixture(),
    });

    expect(result.current.barTop).toBe('0px');
    expect(result.current.topBarTop).toBe('0px');
    expect(result.current.pageContentTop).toBe(`${HEADER_HEIGHT}px`);
  });
});
