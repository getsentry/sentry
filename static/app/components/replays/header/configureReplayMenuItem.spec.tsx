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

  it('nests the doc links behind a single submenu item', () => {
    const item = renderMenuItem({sdkName: 'sentry.javascript.react', isMobile: false});

    expect(item.label).toBe('Configure Replay');
    expect(item.submenu).toBe(true);
    expect(item.children?.length).toBeGreaterThan(0);
  });

  describe('getPath — mobile SDK routing', () => {
    it('enables doc links for sentry.cocoa (iOS)', () => {
      const item = renderMenuItem({sdkName: 'sentry.cocoa', isMobile: true});

      expect(captureSpy).not.toHaveBeenCalled();
      expect(item.children).not.toHaveLength(0);
      item.children?.forEach(child => expect(child.disabled).toBeFalsy());
    });

    it('enables doc links for sentry.cocoa.unreal (iOS Unreal via embedded Cocoa SDK)', () => {
      const item = renderMenuItem({sdkName: 'sentry.cocoa.unreal', isMobile: true});

      // Should NOT fall through to the default case — no captureMessage call
      expect(captureSpy).not.toHaveBeenCalled();
      expect(item.children).not.toHaveLength(0);
      item.children?.forEach(child => expect(child.disabled).toBeFalsy());
    });

    it('logs and disables doc links for unknown mobile platforms', () => {
      const item = renderMenuItem({sdkName: 'sentry.unknown.platform', isMobile: true});

      expect(captureSpy).toHaveBeenCalledWith(
        'Unknown mobile platform in configure card: sentry.unknown.platform'
      );
      expect(item.children).not.toHaveLength(0);
      item.children?.forEach(child => expect(child.disabled).toBe(true));
    });
  });
});
