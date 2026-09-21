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

    it('enables iOS documentation links for sentry.cocoa.unreal', () => {
      const item = renderMenuItem({sdkName: 'sentry.cocoa.unreal', isMobile: true});

      // Should NOT fall through to the default case — no captureMessage call
      expect(captureSpy).not.toHaveBeenCalled();
      expect(item.children).toHaveLength(3);
      expect(item.children?.every(child => child.disabled === false)).toBe(true);
      expect(
        item.children?.every(child => child.externalHref?.includes('/apple/guides/ios/'))
      ).toBe(true);
    });

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
