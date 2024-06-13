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

  it('handles special cases', () => {
    function getFrameworkPlatformWithId(id: PlatformKey): PlatformIntegration {
      return {
        type: 'framework',
        id,
        language: 'language',
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
      'capacitor/capacitor'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('ionic'))).toEqual('ionic/ionic');
    expect(getPlatformPath(getFrameworkPlatformWithId('dart'))).toEqual('dart/dart');
    expect(getPlatformPath(getFrameworkPlatformWithId('android'))).toEqual(
      'android/android'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('flutter'))).toEqual(
      'flutter/flutter'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('unreal'))).toEqual(
      'unreal/unreal'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('unity'))).toEqual('unity/unity');
    expect(getPlatformPath(getFrameworkPlatformWithId('minidump'))).toEqual(
      'minidump/minidump'
    );
    expect(getPlatformPath(getFrameworkPlatformWithId('native-qt'))).toEqual(
      'native/native-qt'
    );

    // Library
    expect(getPlatformPath(getLibraryPlatformWithId('python-celery'))).toEqual(
      'python/celery'
    );
    expect(getPlatformPath(getLibraryPlatformWithId('python-rq'))).toEqual('python/rq');
    expect(getPlatformPath(getLibraryPlatformWithId('python-pymongo'))).toEqual(
      'python/mongo'
    );
  });
});
