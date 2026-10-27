import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useConfigureReplayMenuItem} from 'sentry/components/replays/header/configureReplayMenuItem';

function renderMenuItem({sdkName, isMobile}: {isMobile: boolean; sdkName: string}) {
  const {result} = renderHookWithProviders(useConfigureReplayMenuItem, {
    organization: OrganizationFixture(),
    initialProps: {
      isMobile,
      replayRecord: ReplayRecordFixture({sdk: {name: sdkName, version: '8.0.0'}}),
    },
  });

  return result.current;
}

describe('useConfigureReplayMenuItem', () => {
  let captureSpy: jest.SpyInstance;

  beforeEach(() => {
    captureSpy = jest.spyOn(Sentry, 'captureMessage').mockImplementation(() => '');
  });

  afterEach(() => {
    captureSpy.mockRestore();
  });

  it('returns the configuration documentation submenu', () => {
    const item = renderMenuItem({
      sdkName: 'sentry.javascript.react',
      isMobile: false,
    });

    expect(item).toMatchObject({
      key: 'configure-replay',
      label: 'Configure Replay',
      submenu: true,
    });

    expect(item.children?.map(child => child.key)).toEqual([
      'general',
      'masking',
      'users',
      'network',
      'canvas',
    ]);
  });

  describe('getPath — mobile SDK routing', () => {
    it('enables iOS documentation links for sentry.cocoa', () => {
      const item = renderMenuItem({sdkName: 'sentry.cocoa', isMobile: true});

      expect(captureSpy).not.toHaveBeenCalled();
      expect(item.children).toHaveLength(3);
      expect(item.children?.every(child => child.disabled === false)).toBe(true);
      expect(
        item.children?.every(child => child.externalHref?.includes('/apple/guides/ios/'))
      ).toBe(true);
    });

    it.each([
      ['sentry.native.unreal', '/unreal/'],
      ['sentry.native.xbox.unreal', '/unreal/'],
      ['sentry.cocoa.unreal', '/unreal/'],
      ['sentry.java.android.unreal', '/unreal/'],
      ['sentry.cocoa.kmp', '/kotlin/guides/kotlin-multiplatform/'],
      ['sentry.java.android.kmp', '/kotlin/guides/kotlin-multiplatform/'],
      ['sentry.cocoa.capacitor', '/javascript/guides/capacitor/'],
      ['sentry.java.android.capacitor', '/javascript/guides/capacitor/'],
    ])('enables documentation links for %s', (sdkName, docsPath) => {
      const item = renderMenuItem({sdkName, isMobile: true});

      expect(captureSpy).not.toHaveBeenCalled();
      expect(item.children).toHaveLength(3);
      expect(item.children?.every(child => child.disabled === false)).toBe(true);
      expect(item.children?.every(child => child.externalHref?.includes(docsPath))).toBe(
        true
      );
    });

    it.each(['sentry.cocoa.dotnet', 'sentry.java.android.dotnet'])(
      'disables documentation links without logging for %s',
      sdkName => {
        const item = renderMenuItem({sdkName, isMobile: true});

        expect(captureSpy).not.toHaveBeenCalled();
        expect(item.children).toHaveLength(3);
        expect(item.children?.every(child => child.disabled === true)).toBe(true);
      }
    );

    it('logs and disables documentation links for an unknown mobile platform', () => {
      const item = renderMenuItem({sdkName: 'sentry.unknown.platform', isMobile: true});

      expect(captureSpy).toHaveBeenCalledWith(
        'Unknown mobile platform in configure card: sentry.unknown.platform'
      );
      expect(item.children).toHaveLength(3);
      expect(item.children?.every(child => child.disabled === true)).toBe(true);
    });
  });
});
