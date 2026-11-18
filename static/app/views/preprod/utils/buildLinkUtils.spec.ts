import {skipToken, useQuery} from '@tanstack/react-query';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  getBaseBuildPath,
  getCompareBuildPath,
  getInstallBuildPath,
  getSizeBuildPath,
  getSnapshotPath,
  sizeComparisonApiOptions,
} from './buildLinkUtils';

describe('buildLinkUtils', () => {
  const params = {
    organizationSlug: 'test-org',
    baseArtifactId: 'artifact-123',
  };

  describe('getSizeBuildPath', () => {
    it('returns undefined when baseArtifactId is not provided', () => {
      expect(
        getSizeBuildPath({
          organizationSlug: 'test-org',
        })
      ).toBeUndefined();
    });

    it('generates correct size build path with new URL format', () => {
      expect(getSizeBuildPath(params)).toBe(
        '/organizations/test-org/preprod/size/artifact-123/'
      );
    });
  });

  describe('getInstallBuildPath', () => {
    it('returns undefined when baseArtifactId is not provided', () => {
      expect(
        getInstallBuildPath({
          organizationSlug: 'test-org',
        })
      ).toBeUndefined();
    });

    it('generates correct install build path with new URL format', () => {
      expect(getInstallBuildPath(params)).toBe(
        '/organizations/test-org/preprod/install/artifact-123/'
      );
    });
  });

  describe('getCompareBuildPath', () => {
    it('generates comparison path without base artifact', () => {
      expect(
        getCompareBuildPath({
          organizationSlug: 'test-org',
          headArtifactId: 'head-123',
        })
      ).toBe('/organizations/test-org/preprod/size/compare/head-123/');
    });

    it('generates comparison path with base artifact', () => {
      expect(
        getCompareBuildPath({
          organizationSlug: 'test-org',
          headArtifactId: 'head-123',
          baseArtifactId: 'base-456',
        })
      ).toBe('/organizations/test-org/preprod/size/compare/head-123/base-456/');
    });
  });

  describe('getSnapshotPath', () => {
    it('generates snapshot path with organization slug prefix', () => {
      expect(
        getSnapshotPath({
          organizationSlug: 'test-org',
          snapshotId: 'snapshot-789',
        })
      ).toBe('/organizations/test-org/preprod/snapshots/snapshot-789/');
    });
  });

  describe('getBaseBuildPath', () => {
    it('returns undefined when baseArtifactId is not provided', () => {
      expect(
        getBaseBuildPath({
          organizationSlug: 'test-org',
        })
      ).toBeUndefined();
    });

    it('generates size path when viewType is size', () => {
      expect(getBaseBuildPath(params, 'size')).toBe(
        '/organizations/test-org/preprod/size/artifact-123/'
      );
    });

    it('generates install path when viewType is install', () => {
      expect(getBaseBuildPath(params, 'install')).toBe(
        '/organizations/test-org/preprod/install/artifact-123/'
      );
    });
  });
});

describe('sizeComparisonApiOptions', () => {
  it.each([undefined, 'head-artifact'])(
    'waits for both artifact IDs when the head ID is %s',
    async headArtifactId => {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/preprodartifacts/size-analysis/compare/head-artifact/base-artifact/',
        body: {comparisons: []},
      });
      const initialProps: {baseArtifactId?: string; headArtifactId?: string} = {
        headArtifactId,
      };
      const {result, rerender} = renderHookWithProviders(
        ({headArtifactId: headId, baseArtifactId}) =>
          useQuery(
            sizeComparisonApiOptions(
              headId && baseArtifactId
                ? {organizationSlug: 'org-slug', headArtifactId: headId, baseArtifactId}
                : skipToken
            )
          ),
        {initialProps}
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(request).not.toHaveBeenCalled();

      rerender({headArtifactId: 'head-artifact', baseArtifactId: 'base-artifact'});

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({comparisons: []});
      expect(request).toHaveBeenCalledTimes(1);
    }
  );
});
