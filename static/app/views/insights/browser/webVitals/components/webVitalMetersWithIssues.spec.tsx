import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import WebVitalMetersWithIssues, {
  type ProjectData,
} from 'sentry/views/insights/browser/webVitals/components/webVitalMetersWithIssues';
import type {ProjectScore} from 'sentry/views/insights/browser/webVitals/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/components/pageFilters/usePageFilters');

describe('WebVitalMetersWithIssues', () => {
  const organization = OrganizationFixture();
  const projectScore: ProjectScore = {
    lcpScore: 100,
    fcpScore: 100,
    clsScore: 100,
    ttfbScore: 100,
    inpScore: 100,
  };
  const projectData: ProjectData[] = [];
  let issuesMock: jest.Mock;

  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    issuesMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/issues/',
      body: [],
    });
  });

  it('renders web vital meters', async () => {
    render(
      <WebVitalMetersWithIssues projectData={projectData} projectScore={projectScore} />,
      {
        organization,
      }
    );

    expect(await screen.findByText('Largest Contentful Paint')).toBeInTheDocument();
    expect(screen.getByText('First Contentful Paint')).toBeInTheDocument();
    expect(screen.getByText('Cumulative Layout Shift')).toBeInTheDocument();
    expect(screen.getByText('Time To First Byte')).toBeInTheDocument();
    expect(screen.getByText('Interaction to Next Paint')).toBeInTheDocument();

    expect(issuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          query:
            'is:unresolved issue.type:[web_vitals,performance_render_blocking_asset_span,performance_uncompressed_assets,performance_http_overhead,performance_consecutive_http,performance_n_plus_one_api_calls,performance_large_http_payload,performance_p95_endpoint_regression] !web_vital:[fcp,inp,cls,ttfb]',
        }),
      })
    );
    expect(issuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          query:
            'is:unresolved issue.type:[web_vitals,performance_render_blocking_asset_span,performance_uncompressed_assets,performance_http_overhead,performance_consecutive_http,performance_n_plus_one_api_calls,performance_large_http_payload,performance_p95_endpoint_regression] !web_vital:[lcp,inp,cls,ttfb]',
        }),
      })
    );
    expect(issuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          query:
            'is:unresolved issue.type:[web_vitals,performance_http_overhead,performance_consecutive_http,performance_n_plus_one_api_calls,performance_large_http_payload,performance_p95_endpoint_regression] !web_vital:[lcp,fcp,cls,ttfb]',
        }),
      })
    );
    expect(issuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'is:unresolved issue.type:[web_vitals] !web_vital:[lcp,fcp,inp,ttfb]',
        }),
      })
    );
    expect(issuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          query:
            'is:unresolved issue.type:[web_vitals,performance_http_overhead] !web_vital:[lcp,fcp,inp,cls]',
        }),
      })
    );
    expect(screen.getAllByLabelText('View Performance Issues')).toHaveLength(5);
  });

  it('renders web vital meters with transaction', async () => {
    render(
      <WebVitalMetersWithIssues
        projectData={projectData}
        projectScore={projectScore}
        transaction="test-transaction"
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText('Largest Contentful Paint')).toBeInTheDocument();
    expect(screen.getByText('First Contentful Paint')).toBeInTheDocument();
    expect(screen.getByText('Cumulative Layout Shift')).toBeInTheDocument();
    expect(screen.getByText('Time To First Byte')).toBeInTheDocument();
    expect(screen.getByText('Interaction to Next Paint')).toBeInTheDocument();

    expect(issuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          query:
            'is:unresolved issue.type:[web_vitals,performance_render_blocking_asset_span,performance_uncompressed_assets,performance_http_overhead,performance_consecutive_http,performance_n_plus_one_api_calls,performance_large_http_payload,performance_p95_endpoint_regression] transaction:test-transaction !web_vital:[fcp,inp,cls,ttfb]',
        }),
      })
    );
  });
});
