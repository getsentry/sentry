import type {PlatformIntegration, PlatformKey} from 'sentry/types/project';
import {getPlatformPath} from 'sentry/utils/gettingStartedDocs/getPlatformPath';

describe('getPlatformPath', () => {
  it('returns the correct path for a framework platform', () => {
    const platform: PlatformIntegration = {
      type: 'framework',
      id: 'javascript-react',
      language: 'javascript',
      link: 'link',
      name: 'name',
    };

    expect(getPlatformPath(platform)).toEqual('javascript/react');
  });

  it('returns the correct path for a language platform', () => {
    const platform: PlatformIntegration = {
      type: 'language',
      id: 'python',
      language: 'python',
      link: 'link',
      name: 'name',
    };

    expect(getPlatformPath(platform)).toEqual('python/python');
  });

  it('returns the correct path for the multi-word framework', () => {
    const platform: PlatformIntegration = {
      type: 'framework',
      id: 'java-spring-boot',
      language: 'java',
      link: 'link',
      name: 'name',
    };

    expect(getPlatformPath(platform)).toEqual('java/spring-boot');
  });

  it('handles special cases', () => {
    function getFrameworkPlatformWithId(id: PlatformKey): PlatformIntegration {
      return {
        id,
        language: 'language',
        type: 'framework',
        link: 'link',
        name: 'name',
      };
    }

    function getLibraryPlatformWithId(id: PlatformKey): PlatformIntegration {
      return {
        type: 'library',
        id,
        language: 'language',
        link: 'link',
        name: 'name',
      };
    }

    // Frameworks
    expect(getPlatformPath(getFrameworkPlatformWithId('capacitor'))).toEqual(
      'language/language'
    );

    expect(getPlatformPath(getFrameworkPlatformWithId('ionic'))).toEqual(
      'language/language'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('dart'))).toEqual(
      'language/language'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('android'))).toEqual(
      'language/language'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('flutter'))).toEqual(
      'language/language'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('unreal'))).toEqual(
      'language/language'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('unity'))).toEqual(
      'language/language'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('minidump'))).toEqual(
      'language/language'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('native-qt'))).toEqual(
      'language/qt'
    );

    // Library
    expect(getPlatformPath(getLibraryPlatformWithId('python-celery'))).toEqual(
      'language/celery'
    );
    expect(getPlatformPath(getLibraryPlatformWithId('python-rq'))).toEqual('language/rq');
    expect(getPlatformPath(getLibraryPlatformWithId('python-pymongo'))).toEqual(
      'language/pymongo'
    );
  });
});
