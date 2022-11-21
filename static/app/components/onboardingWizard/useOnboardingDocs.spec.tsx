import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useOnboardingDocs from 'sentry/components/onboardingWizard/useOnboardingDocs';
import {
  generateDocKeys,
  isPlatformSupported,
} from 'sentry/components/performanceOnboarding/utils';
import {PlatformIntegration} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('useOnboardingDocs', function () {
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

    const docKeys = generateDocKeys(project.platform);

    docKeys.forEach(docKey => {
      apiMocks[docKey] = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/docs/${docKey}/`,
        method: 'GET',
        body: {html: `${docKey} content`},
      });
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useOnboardingDocs, {
      initialProps: {
        project,
        docKeys,
        isPlatformSupported: isPlatformSupported({
          id: project.platform,
        } as PlatformIntegration),
      },
      wrapper,
    });
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

    const docKeys = generateDocKeys(project.platform);

    docKeys.forEach(docKey => {
      apiMocks[docKey] = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/docs/${docKey}/`,
        method: 'GET',
        body: {html: `${docKey} content`},
      });
    });

    const {result} = reactHooks.renderHook(useOnboardingDocs, {
      initialProps: {
        project,
        docKeys,
        isPlatformSupported: isPlatformSupported({
          id: project.platform,
        } as PlatformIntegration),
      },
      wrapper,
    });
    const {docContents, isLoading, hasOnboardingContents} = result.current;

    expect(isLoading).toEqual(false);
    expect(docContents).toEqual({});
    expect(hasOnboardingContents).toEqual(false);
    Object.values(apiMocks).forEach(mock => {
      expect(mock).not.toHaveBeenCalled();
    });
  });

  it('project with no support', function () {
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

    const docKeys = generateDocKeys(project.platform);

    docKeys.forEach(docKey => {
      apiMocks[docKey] = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/docs/${docKey}/`,
        method: 'GET',
        body: {html: `${docKey} content`},
      });
    });

    const {result} = reactHooks.renderHook(useOnboardingDocs, {
      initialProps: {
        project,
        docKeys,
        isPlatformSupported: isPlatformSupported({
          id: project.platform,
        } as PlatformIntegration),
      },
      wrapper,
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
