import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import * as OnboardingContext from 'sentry/components/onboarding/onboardingContext';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useConfigureSdk} from './useConfigureSdk';

jest.mock('sentry/actionCreators/modal');
jest.mock('sentry/components/onboarding/useCreateProject');

const mockUseOnboardingContext = jest.spyOn(OnboardingContext, 'useOnboardingContext');
const mockCreateProject = jest.fn();
const mockOpenModal = openModal as jest.Mock;

function mockCreateProjectHook() {
  let isPending = false;

  const mutateAsync = async (...args: any[]) => {
    isPending = true;
    try {
      const result = await mockCreateProject(...args);
      return result;
    } finally {
      isPending = false;
    }
  };

  return {
    mutateAsync,
    get isPending() {
      return isPending;
    },
  };
}

const mockUseCreateProject = useCreateProject as jest.Mock;

function createWrapper(organization: Organization) {
  const queryClient = makeTestQueryClient();
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={queryClient}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  };
}

describe('useConfigureSdk', () => {
  const organization = OrganizationFixture();
  const onComplete = jest.fn();

  let createProjectInstance: ReturnType<typeof mockCreateProjectHook>;

  const frameworkModalSupportedPlatform: OnboardingSelectedSDK = {
    key: 'javascript',
    type: 'language',
    language: 'javascript',
    name: 'JavaScript',
    category: 'popular',
    link: 'https://docs.sentry.io/platforms/javascript/',
  };

  const notFrameworkModalSupportedPlatform: OnboardingSelectedSDK = {
    key: 'other',
    type: 'language',
    language: 'other',
    name: 'Other',
    category: 'other',
    link: 'https://docs.sentry.io/platforms/other/',
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([ProjectFixture()]);

    mockUseOnboardingContext.mockReturnValue({
      setSelectedPlatform: jest.fn(),
    });

    createProjectInstance = mockCreateProjectHook();
    mockUseCreateProject.mockReturnValue(createProjectInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading state correctly', () => {
    const {result} = renderHook(() => useConfigureSdk({onComplete}), {
      wrapper: createWrapper(organization),
    });

    expect(result.current.isLoadingData).toBe(true);
  });

  it('opens the framework suggestion modal if platform is supported', async () => {
    const {result} = renderHook(() => useConfigureSdk({onComplete}), {
      wrapper: createWrapper(organization),
    });

    await act(async () => {
      await result.current.configureSdk(frameworkModalSupportedPlatform);
    });

    expect(mockOpenModal).toHaveBeenCalled();
  });

  it('does not open the framework suggestion modal if platform is not supported', async () => {
    const {result} = renderHook(() => useConfigureSdk({onComplete}), {
      wrapper: createWrapper(organization),
    });

    await act(async () => {
      await result.current.configureSdk(notFrameworkModalSupportedPlatform);
    });

    expect(mockOpenModal).not.toHaveBeenCalled();
    expect(mockCreateProject).toHaveBeenCalled();
  });

  it('creates project only once even if called multiple times', async () => {
    const {result} = renderHook(() => useConfigureSdk({onComplete}), {
      wrapper: createWrapper(organization),
    });

    mockCreateProject.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 10))
    );

    await act(async () => {
      const promise1 = result.current.configureSdk(notFrameworkModalSupportedPlatform);
      const promise2 = result.current.configureSdk(notFrameworkModalSupportedPlatform);
      const promise3 = result.current.configureSdk(notFrameworkModalSupportedPlatform);

      await Promise.all([promise1, promise2, promise3]);
    });

    expect(mockCreateProject).toHaveBeenCalledTimes(1);
  });
});
