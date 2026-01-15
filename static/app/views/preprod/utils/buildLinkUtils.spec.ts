import {
  getBaseBuildPath,
  getCompareBuildPath,
  getInstallBuildPath,
  getListBuildPath,
  getSizeBuildPath,
} from './buildLinkUtils';

describe('buildLinkUtils', () => {
  const params = {
    organizationSlug: 'test-org',
    projectId: 'test-project',
    baseArtifactId: 'artifact-123',
  };

  describe('getSizeBuildPath', () => {
    it('returns undefined when baseArtifactId is not provided', () => {
      expect(
        getSizeBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
        })
      ).toBeUndefined();
    });

    it('generates correct size build path with new URL format', () => {
      expect(getSizeBuildPath(params)).toBe(
        '/organizations/test-org/preprod/size/artifact-123/?project=test-project'
      );
    });
  });

  describe('getInstallBuildPath', () => {
    it('returns undefined when baseArtifactId is not provided', () => {
      expect(
        getInstallBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
        })
      ).toBeUndefined();
    });

    it('generates correct install build path with new URL format', () => {
      expect(getInstallBuildPath(params)).toBe(
        '/organizations/test-org/preprod/install/artifact-123/?project=test-project'
      );
    });
  });

  describe('getCompareBuildPath', () => {
    it('generates comparison path without base artifact', () => {
      expect(
        getCompareBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
          headArtifactId: 'head-123',
        })
      ).toBe(
        '/organizations/test-org/preprod/size/compare/head-123/?project=test-project'
      );
    });

    it('generates comparison path with base artifact', () => {
      expect(
        getCompareBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
          headArtifactId: 'head-123',
          baseArtifactId: 'base-456',
        })
      ).toBe(
        '/organizations/test-org/preprod/size/compare/head-123/base-456/?project=test-project'
      );
    });
  });

  describe('getListBuildPath', () => {
    it('generates correct list path with project query param', () => {
      expect(
        getListBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
        })
      ).toBe('/organizations/test-org/preprod/?project=test-project');
    });
  });

  describe('getBaseBuildPath', () => {
    it('returns undefined when baseArtifactId is not provided', () => {
      expect(
        getBaseBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
        })
      ).toBeUndefined();
    });

    it('generates size path when viewType is size', () => {
      expect(getBaseBuildPath(params, 'size')).toBe(
        '/organizations/test-org/preprod/size/artifact-123/?project=test-project'
      );
    });

    it('generates install path when viewType is install', () => {
      expect(getBaseBuildPath(params, 'install')).toBe(
        '/organizations/test-org/preprod/install/artifact-123/?project=test-project'
      );
    });
  });
});
