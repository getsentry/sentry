import {
  getBaseBuildPath,
  getCompareBuildPath,
  getInstallBuildPath,
  getSizeBuildPath,
  getSnapshotPath,
  makeSnapshotsListUrl,
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

  describe('makeSnapshotsListUrl', () => {
    it('returns the bare list url without params', () => {
      expect(makeSnapshotsListUrl('org-slug')).toBe(
        '/organizations/org-slug/explore/snapshots/'
      );
    });

    it('includes provided params and skips empty ones', () => {
      expect(
        makeSnapshotsListUrl('org-slug', {
          project: ['1', '2'],
          query: 'app_id:com.example.app',
          statsPeriod: '7d',
          start: undefined,
          end: '',
        })
      ).toBe(
        '/organizations/org-slug/explore/snapshots/?project=1&project=2&query=app_id%3Acom.example.app&statsPeriod=7d'
      );
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
