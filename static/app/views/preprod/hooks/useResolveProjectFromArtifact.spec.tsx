import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreprodBuildDetailsWithSizeInfoFixture} from 'sentry-fixture/preprod';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useResolveProjectFromArtifact} from 'sentry/views/preprod/hooks/useResolveProjectFromArtifact';
import {BuildDetailsSizeAnalysisState} from 'sentry/views/preprod/types/buildDetailsTypes';

const COMPLETED_SIZE_INFO = {
  state: BuildDetailsSizeAnalysisState.COMPLETED as const,
  size_metrics: [],
  base_size_metrics: [],
};

describe('useResolveProjectFromArtifact', () => {
  const organization = OrganizationFixture();

  it('returns projectId from URL when project query param is present', () => {
    const {result} = renderHookWithProviders(
      () => useResolveProjectFromArtifact(undefined),
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/preprod/size/123/`,
            query: {project: '456'},
          },
        },
      }
    );

    expect(result.current).toBe('456');
  });

  it('returns project slug from build details data when project query param is missing', () => {
    const buildDetails = PreprodBuildDetailsWithSizeInfoFixture(COMPLETED_SIZE_INFO);

    const {result} = renderHookWithProviders(
      () => useResolveProjectFromArtifact(buildDetails),
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/preprod/size/123/`,
          },
        },
      }
    );

    expect(result.current).toBe(buildDetails.project_slug);
  });

  it('returns undefined when no project param and no build details data', () => {
    const {result} = renderHookWithProviders(
      () => useResolveProjectFromArtifact(undefined),
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/preprod/size/123/`,
          },
        },
      }
    );

    expect(result.current).toBeUndefined();
  });

  it('prefers URL project param over build details data', () => {
    const buildDetails = PreprodBuildDetailsWithSizeInfoFixture(COMPLETED_SIZE_INFO);

    const {result} = renderHookWithProviders(
      () => useResolveProjectFromArtifact(buildDetails),
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/preprod/size/123/`,
            query: {project: '999'},
          },
        },
      }
    );

    expect(result.current).toBe('999');
  });
});
