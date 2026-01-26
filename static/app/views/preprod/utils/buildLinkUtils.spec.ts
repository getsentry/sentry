import ConfigStore from 'sentry/stores/configStore';

import {
  getBaseBuildPath,
  getCompareBuildPath,
  getInstallBuildPath,
  getListBuildPath,
  getSizeBuildPath,
} from './buildLinkUtils';

describe('buildLinkUtils with customer domain', () => {
  const params = {
    organizationSlug: 'test-org',
    projectId: 'test-project',
    baseArtifactId: 'artifact-123',
  };

  beforeEach(() => {
    ConfigStore.set('customerDomain', {
      subdomain: 'test-org',
      organizationUrl: 'https://test-org.sentry.io',
      sentryUrl: 'https://sentry.io',
    });
  });

  afterEach(() => {
    ConfigStore.set('customerDomain', null);
  });

  describe('getSizeBuildPath', () => {
    it('returns undefined when baseArtifactId is not provided', () => {
      expect(
        getSizeBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
        })
      ).toBeUndefined();
    });

    it('generates orgless path for size view', () => {
      expect(getSizeBuildPath(params)).toBe(
        '/preprod/size/artifact-123/?project=test-project'
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

    it('generates orgless path for install view', () => {
      expect(getInstallBuildPath(params)).toBe(
        '/preprod/install/artifact-123/?project=test-project'
      );
    });
  });

  describe('getCompareBuildPath', () => {
    it('generates orgless path for comparison without base artifact', () => {
      expect(
        getCompareBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
          headArtifactId: 'head-123',
        })
      ).toBe('/preprod/size/compare/head-123/?project=test-project');
    });

    it('generates orgless path for comparison with base artifact', () => {
      expect(
        getCompareBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
          headArtifactId: 'head-123',
          baseArtifactId: 'base-456',
        })
      ).toBe('/preprod/size/compare/head-123/base-456/?project=test-project');
    });
  });

  describe('getListBuildPath', () => {
    it('generates orgless path for list', () => {
      expect(
        getListBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
        })
      ).toBe('/preprod/?project=test-project');
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

    it('generates orgless path for size view', () => {
      expect(getBaseBuildPath(params, 'size')).toBe(
        '/preprod/size/artifact-123/?project=test-project'
      );
    });

    it('generates orgless path for install view', () => {
      expect(getBaseBuildPath(params, 'install')).toBe(
        '/preprod/install/artifact-123/?project=test-project'
      );
    });
  });
});

describe('buildLinkUtils without customer domain', () => {
  const params = {
    organizationSlug: 'test-org',
    projectId: 'test-project',
    baseArtifactId: 'artifact-123',
  };

  beforeEach(() => {
    ConfigStore.set('customerDomain', null);
  });

  describe('getSizeBuildPath', () => {
    it('returns undefined when baseArtifactId is not provided', () => {
      expect(
        getSizeBuildPath({
          organizationSlug: 'test-org',
          projectId: 'test-project',
        })
      ).toBeUndefined();
    });

    it('generates org-prefixed path for size view', () => {
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

    it('generates org-prefixed path for install view', () => {
      expect(getInstallBuildPath(params)).toBe(
        '/organizations/test-org/preprod/install/artifact-123/?project=test-project'
      );
    });
  });

  describe('getCompareBuildPath', () => {
    it('generates org-prefixed path for comparison without base artifact', () => {
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

    it('generates org-prefixed path for comparison with base artifact', () => {
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
    it('generates org-prefixed path for list', () => {
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

    it('generates org-prefixed path for size view', () => {
      expect(getBaseBuildPath(params, 'size')).toBe(
        '/organizations/test-org/preprod/size/artifact-123/?project=test-project'
      );
    });

    it('generates org-prefixed path for install view', () => {
      expect(getBaseBuildPath(params, 'install')).toBe(
        '/organizations/test-org/preprod/install/artifact-123/?project=test-project'
      );
    });
  });
});
