import {renderHook} from 'sentry-test/reactTestingLibrary';

import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT,
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
} from 'sentry/views/navigation/constants';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

import {useIssueDetailsStickyTopOffset} from './useIssueDetailsStickyTopOffset';

jest.mock('sentry/views/navigation/primaryNavigationContext');
jest.mock('sentry/views/navigation/useHasPageFrameFeature');
jest.mock('sentry/views/navigation/useTopOffset');

describe('useIssueDetailsStickyTopOffset', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    jest.mocked(usePrimaryNavigation).mockReturnValue({
      activeGroup: 'issues',
      features: {hover: true},
      layout: 'sidebar',
      setActiveGroup: jest.fn(),
    });
    jest.mocked(useHasPageFrameFeature).mockReturnValue(false);
    jest.mocked(useTopOffset).mockReturnValue('0px');
  });

  it('returns 0 on desktop without page frame', () => {
    const {result} = renderHook(() => useIssueDetailsStickyTopOffset());

    expect(result.current).toBe(0);
  });

  it('returns the legacy mobile nav height without page frame', () => {
    jest.mocked(usePrimaryNavigation).mockReturnValue({
      activeGroup: 'issues',
      features: {hover: true},
      layout: 'mobile',
      setActiveGroup: jest.fn(),
    });

    const {result} = renderHook(() => useIssueDetailsStickyTopOffset());

    expect(result.current).toBe(NAVIGATION_MOBILE_TOPBAR_HEIGHT);
  });

  it('returns the page-frame desktop header height on desktop', () => {
    jest.mocked(useHasPageFrameFeature).mockReturnValue(true);

    const {result} = renderHook(() => useIssueDetailsStickyTopOffset());

    expect(result.current).toBe(PRIMARY_HEADER_HEIGHT);
  });

  it('returns the page-frame mobile header height on mobile', () => {
    jest.mocked(usePrimaryNavigation).mockReturnValue({
      activeGroup: 'issues',
      features: {hover: true},
      layout: 'mobile',
      setActiveGroup: jest.fn(),
    });
    jest.mocked(useHasPageFrameFeature).mockReturnValue(true);

    const {result} = renderHook(() => useIssueDetailsStickyTopOffset());

    expect(result.current).toBe(NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME);
  });

  it('includes the top offset above the page-frame header', () => {
    jest.mocked(useHasPageFrameFeature).mockReturnValue(true);
    jest.mocked(useTopOffset).mockReturnValue('24px');

    const {result} = renderHook(() => useIssueDetailsStickyTopOffset());

    expect(result.current).toBe(PRIMARY_HEADER_HEIGHT + 24);
  });
});
