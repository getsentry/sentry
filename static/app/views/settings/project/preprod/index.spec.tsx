import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

// eslint-disable-next-line boundaries/element-types -- getsentry test fixtures for subscription
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
// eslint-disable-next-line boundaries/element-types -- getsentry test fixtures for subscription
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

// eslint-disable-next-line boundaries/element-types -- getsentry subscription store for testing
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

import PreprodSettings from './index';

// Mock child components that have act() warnings
jest.mock('./statusCheckRules', () => ({
  StatusCheckRules: () => <div data-test-id="status-check-rules-mock" />,
}));
jest.mock('./featureFilter', () => ({
  FeatureFilter: () => <div data-test-id="feature-filter-mock" />,
}));

describe('PreprodSettings', () => {
  const organization = OrganizationFixture({
    features: ['preprod-issues'],
  });
  const project = ProjectFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repositories/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/builds/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });
    SubscriptionStore.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows banner when SIZE_ANALYSIS quota exceeded', () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        errors: MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: 5000,
          usage: 1000,
          usageExceeded: false,
        }),
        sizeAnalyses: MetricHistoryFixture({
          category: DataCategory.SIZE_ANALYSIS,
          reserved: 100,
          usage: 101,
          usageExceeded: true,
        }),
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<PreprodSettings />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/mobile-builds/`,
        },
      },
    });

    expect(
      screen.getByText(/used your full quota of 100 Size Analysis builds/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /upgrade your plan/i})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/billing/`
    );
  });

  it('hides banner when SIZE_ANALYSIS quota not exceeded', () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        errors: MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: 5000,
          usage: 1000,
          usageExceeded: false,
        }),
        sizeAnalyses: MetricHistoryFixture({
          category: DataCategory.SIZE_ANALYSIS,
          reserved: 100,
          usage: 50,
          usageExceeded: false,
        }),
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<PreprodSettings />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/mobile-builds/`,
        },
      },
    });

    expect(
      screen.queryByText(/used your full quota of.*Size Analysis builds/i)
    ).not.toBeInTheDocument();
  });

  it('hides banner when no subscription data', () => {
    render(<PreprodSettings />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/mobile-builds/`,
        },
      },
    });

    expect(
      screen.queryByText(/used your full quota of.*Size Analysis builds/i)
    ).not.toBeInTheDocument();
  });

  it('hides banner when SIZE_ANALYSIS category missing', () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        errors: MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: 5000,
          usage: 1000,
          usageExceeded: false,
        }),
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<PreprodSettings />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/mobile-builds/`,
        },
      },
    });

    expect(
      screen.queryByText(/used your full quota of.*Size Analysis builds/i)
    ).not.toBeInTheDocument();
  });

  it('shows correct quota value in banner', () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        errors: MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: 5000,
          usage: 1000,
          usageExceeded: false,
        }),
        sizeAnalyses: MetricHistoryFixture({
          category: DataCategory.SIZE_ANALYSIS,
          reserved: 250,
          usage: 251,
          usageExceeded: true,
        }),
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<PreprodSettings />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/mobile-builds/`,
        },
      },
    });

    expect(
      screen.getByText(/used your full quota of 250 Size Analysis builds/i)
    ).toBeInTheDocument();
  });

  it('uses default quota value when reserved is undefined', () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        errors: MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: 5000,
          usage: 1000,
          usageExceeded: false,
        }),
        sizeAnalyses: {
          ...MetricHistoryFixture({
            category: DataCategory.SIZE_ANALYSIS,
            usage: 101,
            usageExceeded: true,
          }),
          reserved: undefined as any,
        },
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<PreprodSettings />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/mobile-builds/`,
        },
      },
    });

    expect(
      screen.getByText(/used your full quota of 100 Size Analysis builds/i)
    ).toBeInTheDocument();
  });
});
