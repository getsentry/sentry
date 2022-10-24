import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import usePerformanceOnboardingDocs, {
  generateOnboardingDocKeys,
} from 'sentry/components/performanceOnboarding/usePerformanceOnboardingDocs';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('usePerformanceOnboardingDocs', function () {
  it('fetches onboarding documentation steps', async function () {
    const {organization} = initializeOrg({
      router: {
        location: {query: {}, search: ''},
        push: jest.fn(),
      },
    } as any);
    const wrapper = ({children}: {children?: React.ReactNode}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const project = TestStubs.Project({
      platform: 'javascript-react',
      firstTransactionEvent: false,
    });

    const apiMocks: any = {};

    const docKeys = generateOnboardingDocKeys(project.platform);

    expect(docKeys).toEqual([
      'javascript-react-performance-onboarding-1-install',
      'javascript-react-performance-onboarding-2-configure',
      'javascript-react-performance-onboarding-3-verify',
    ]);

    docKeys.forEach(docKey => {
      apiMocks[docKey] = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/docs/${docKey}/`,
        method: 'GET',
        body: {html: `${docKey} content`},
      });
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(
      usePerformanceOnboardingDocs,
      {
        initialProps: project,
        wrapper,
      }
    );
    await waitForNextUpdate();
    const {docContents, isLoading, hasOnboardingContents} = result.current;

    expect(isLoading).toEqual(false);
    const expectedDocContents = Object.keys(apiMocks).reduce((acc, key) => {
      acc[key] = `${key} content`;
      return acc;
    }, {});
    expect(docContents).toEqual(expectedDocContents);
    expect(hasOnboardingContents).toEqual(true);
    Object.values(apiMocks).forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
  });

  it('project with no onboarding support', function () {
    const {organization} = initializeOrg({
      router: {
        location: {query: {}, search: ''},
        push: jest.fn(),
      },
    } as any);
    const wrapper = ({children}: {children?: React.ReactNode}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const project = TestStubs.Project({
      platform: 'javascript-angular',
      firstTransactionEvent: false,
    });

    const apiMocks: any = {};

    const docKeys = generateOnboardingDocKeys(project.platform);

    expect(docKeys).toEqual([
      'javascript-angular-performance-onboarding-1-install',
      'javascript-angular-performance-onboarding-2-configure',
      'javascript-angular-performance-onboarding-3-verify',
    ]);

    docKeys.forEach(docKey => {
      apiMocks[docKey] = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/docs/${docKey}/`,
        method: 'GET',
        body: {html: `${docKey} content`},
      });
    });

    const {result} = reactHooks.renderHook(usePerformanceOnboardingDocs, {
      wrapper,
      initialProps: project,
    });
    const {docContents, isLoading, hasOnboardingContents} = result.current;

    expect(isLoading).toEqual(false);
    expect(docContents).toEqual({});
    expect(hasOnboardingContents).toEqual(false);
    Object.values(apiMocks).forEach(mock => {
      expect(mock).not.toHaveBeenCalled();
    });
  });

  it('project with no performance support', function () {
    const {organization} = initializeOrg({
      router: {
        location: {query: {}, search: ''},
        push: jest.fn(),
      },
    } as any);
    const wrapper = ({children}: {children?: React.ReactNode}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const project = TestStubs.Project({
      platform: 'elixir',
      firstTransactionEvent: false,
    });

    const apiMocks: any = {};

    const docKeys = generateOnboardingDocKeys(project.platform);

    expect(docKeys).toEqual([
      'elixir-performance-onboarding-1-install',
      'elixir-performance-onboarding-2-configure',
      'elixir-performance-onboarding-3-verify',
    ]);

    docKeys.forEach(docKey => {
      apiMocks[docKey] = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/docs/${docKey}/`,
        method: 'GET',
        body: {html: `${docKey} content`},
      });
    });

    const {result} = reactHooks.renderHook(usePerformanceOnboardingDocs, {
      wrapper,
      initialProps: project,
    });
    const {docContents, isLoading, hasOnboardingContents} = result.current;

    expect(isLoading).toEqual(false);
    expect(docContents).toEqual({});
    expect(hasOnboardingContents).toEqual(false);
    Object.values(apiMocks).forEach(mock => {
      expect(mock).not.toHaveBeenCalled();
    });
  });
});
