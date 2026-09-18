import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';

import {useShowConversationOnboarding} from './useShowConversationOnboarding';

jest.mock('sentry/views/insights/common/queries/useDiscover', () => ({
  useSpans: jest.fn(),
}));

jest.mock('sentry/views/insights/common/queries/useHasFirstSpan');

jest.mock('sentry/utils/useLocalStorageState', () => ({useLocalStorageState: jest.fn()}));

const mockUseSpans = jest.mocked(useSpans);
const mockUseHasFirstSpan = jest.mocked(useHasFirstSpan);
const mockUseLocalStorageState = jest.mocked(useLocalStorageState);

describe('useShowConversationOnboarding', () => {
  const organization = OrganizationFixture();
  let mockSetProjectsWithConversations: jest.Mock;

  beforeEach(() => {
    mockSetProjectsWithConversations = jest.fn();
    mockUseHasFirstSpan.mockReturnValue(false);

    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [1],
        environments: [],
        datetime: {period: '24h', start: null, end: null, utc: false},
      })
    );
  });

  afterEach(() => {
    PageFiltersStore.reset();
    jest.clearAllMocks();
  });

  it('shows onboarding when no data and no localStorage entry', () => {
    mockUseLocalStorageState.mockReturnValue([[], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.showOnboarding).toBe(true);
    expect(result.current.hasConversations).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('reports agentic spans without conversations', () => {
    mockUseHasFirstSpan.mockReturnValue(true);
    mockUseLocalStorageState.mockReturnValue([[], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.hasAgenticSpans).toBe(true);
    expect(result.current.hasConversations).toBe(false);
  });

  it('does not show onboarding when query returns data', () => {
    mockUseLocalStorageState.mockReturnValue([[], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [{id: 'span-1'}],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.hasConversations).toBe(true);
    expect(result.current.hasAgenticSpans).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('stores project IDs in localStorage when data is found', () => {
    mockUseLocalStorageState.mockReturnValue([[], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [{id: 'span-1'}],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    renderHookWithProviders(useShowConversationOnboarding, {organization});

    expect(mockSetProjectsWithConversations).toHaveBeenCalled();
    const updater = mockSetProjectsWithConversations.mock.calls[0][0];
    const result = updater([]);
    expect(result).toEqual([1]);
  });

  it('does not show onboarding when localStorage knows projects have data even if query returns empty', () => {
    mockUseLocalStorageState.mockReturnValue([[1], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('shows onboarding for a project not in localStorage even if other projects are', () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [2],
        environments: [],
        datetime: {period: '1h', start: null, end: null, utc: false},
      })
    );

    mockUseLocalStorageState.mockReturnValue([[1], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.showOnboarding).toBe(true);
  });

  it('skips loading state when localStorage already knows projects have data', () => {
    mockUseLocalStorageState.mockReturnValue([[1], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.showOnboarding).toBe(false);
  });

  it('merges new project IDs with existing localStorage entries', () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [2],
        environments: [],
        datetime: {period: '24h', start: null, end: null, utc: false},
      })
    );

    mockUseLocalStorageState.mockReturnValue([[1], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [{id: 'span-1'}],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    renderHookWithProviders(useShowConversationOnboarding, {organization});

    expect(mockSetProjectsWithConversations).toHaveBeenCalled();
    const updater = mockSetProjectsWithConversations.mock.calls[0][0];
    const result = updater([1]);
    expect(result).toEqual([1, 2]);
  });

  it('does not update localStorage when all project IDs are already stored', () => {
    mockUseLocalStorageState.mockReturnValue([[1], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [{id: 'span-1'}],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    renderHookWithProviders(useShowConversationOnboarding, {organization});

    expect(mockSetProjectsWithConversations).toHaveBeenCalled();
    const updater = mockSetProjectsWithConversations.mock.calls[0][0];
    const prevArray = [1];
    const result = updater(prevArray);
    // Returns the same array reference when no change is needed
    expect(result).toBe(prevArray);
  });

  it('shows loading when query is loading and localStorage has no data', () => {
    mockUseLocalStorageState.mockReturnValue([[], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.showOnboarding).toBe(false);
  });

  it('stores -1 sentinel for all-projects selection instead of individual IDs', () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [],
        environments: [],
        datetime: {period: '24h', start: null, end: null, utc: false},
      })
    );

    mockUseLocalStorageState.mockReturnValue([[], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [{id: 'span-1'}],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    renderHookWithProviders(useShowConversationOnboarding, {organization});

    expect(mockSetProjectsWithConversations).toHaveBeenCalled();
    const updater = mockSetProjectsWithConversations.mock.calls[0][0];
    const result = updater([]);
    expect(result).toEqual([ALL_ACCESS_PROJECTS]);
  });

  it('does not show onboarding for all-projects when -1 is in localStorage', () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [],
        environments: [],
        datetime: {period: '1h', start: null, end: null, utc: false},
      })
    );

    mockUseLocalStorageState.mockReturnValue([
      [ALL_ACCESS_PROJECTS],
      mockSetProjectsWithConversations,
    ]);
    mockUseSpans.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.showOnboarding).toBe(false);
  });

  it('does not show onboarding for all-projects when specific projects have data in localStorage', () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [],
        environments: [],
        datetime: {period: '1h', start: null, end: null, utc: false},
      })
    );

    mockUseLocalStorageState.mockReturnValue([[1], mockSetProjectsWithConversations]);
    mockUseSpans.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.showOnboarding).toBe(false);
  });

  it('does not let all-projects sentinel suppress onboarding for a specific project', () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [2],
        environments: [],
        datetime: {period: '1h', start: null, end: null, utc: false},
      })
    );

    mockUseLocalStorageState.mockReturnValue([
      [ALL_ACCESS_PROJECTS],
      mockSetProjectsWithConversations,
    ]);
    mockUseSpans.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.showOnboarding).toBe(true);
  });
});
