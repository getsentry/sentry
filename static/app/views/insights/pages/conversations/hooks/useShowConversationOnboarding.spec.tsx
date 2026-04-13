import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';

import {useShowConversationOnboarding} from './useShowConversationOnboarding';

jest.mock('sentry/views/insights/common/queries/useDiscover', () => ({
  useSpans: jest.fn(),
}));

jest.mock('sentry/utils/useLocalStorageState', () => ({
  useLocalStorageState: jest.fn(),
}));

jest.mock('sentry/components/pageFilters/usePageFilters');

const mockUseSpans = jest.mocked(useSpans);
const mockUseLocalStorageState = jest.mocked(useLocalStorageState);
const mockUsePageFilters = jest.mocked(usePageFilters);

describe('useShowConversationOnboarding', () => {
  const organization = OrganizationFixture();
  let mockSetProjectsWithConversations: jest.Mock;

  beforeEach(() => {
    mockSetProjectsWithConversations = jest.fn();

    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'project-a'}),
      ProjectFixture({id: '2', slug: 'project-b'}),
    ]);

    mockUsePageFilters.mockReturnValue({
      isReady: true,
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        projects: [1],
        environments: [],
        datetime: {period: '24h', start: null, end: null, utc: false},
      },
    } as any);
  });

  afterEach(() => {
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
    expect(result.current.isLoading).toBe(false);
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
    mockUsePageFilters.mockReturnValue({
      isReady: true,
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        projects: [2],
        environments: [],
        datetime: {period: '1h', start: null, end: null, utc: false},
      },
    } as any);

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
    mockUsePageFilters.mockReturnValue({
      isReady: true,
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        projects: [2],
        environments: [],
        datetime: {period: '24h', start: null, end: null, utc: false},
      },
    } as any);

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
});
