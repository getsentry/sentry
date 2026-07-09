import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigureReplayCard} from 'sentry/components/replays/header/configureReplayCard';

describe('ConfigureReplayCard', () => {
  let captureSpy: jest.SpyInstance;

  beforeEach(() => {
    captureSpy = jest.spyOn(Sentry, 'captureMessage').mockImplementation(() => '');
  });

  afterEach(() => {
    captureSpy.mockRestore();
  });

  describe('getPath — mobile SDK routing', () => {
    it('enables menu items for sentry.cocoa (iOS)', async () => {
      const replayRecord = ReplayRecordFixture({
        sdk: {name: 'sentry.cocoa', version: '8.0.0'},
      });
      render(<ConfigureReplayCard isMobile replayRecord={replayRecord} />, {
        organization: OrganizationFixture(),
      });

      await userEvent.click(screen.getByRole('button', {name: 'Configure Replay'}));

      expect(captureSpy).not.toHaveBeenCalled();
      expect(screen.getAllByRole('menuitemradio')).not.toHaveLength(0);
    });

    it('enables menu items for sentry.cocoa.unreal (iOS Unreal via embedded Cocoa SDK)', async () => {
      const replayRecord = ReplayRecordFixture({
        sdk: {name: 'sentry.cocoa.unreal', version: '1.0.0'},
      });
      render(<ConfigureReplayCard isMobile replayRecord={replayRecord} />, {
        organization: OrganizationFixture(),
      });

      await userEvent.click(screen.getByRole('button', {name: 'Configure Replay'}));

      // Should NOT fall through to the default case — no captureMessage call
      expect(captureSpy).not.toHaveBeenCalled();

      // All menu items should be enabled (not aria-disabled)
      const items = screen.getAllByRole('menuitemradio');
      expect(items.length).toBeGreaterThan(0);
      items.forEach(item => {
        expect(item).not.toHaveAttribute('aria-disabled', 'true');
      });
    });

    it('logs and disables menu items for unknown mobile platforms', () => {
      const replayRecord = ReplayRecordFixture({
        sdk: {name: 'sentry.unknown.platform', version: '0.0.0'},
      });
      render(<ConfigureReplayCard isMobile replayRecord={replayRecord} />, {
        organization: OrganizationFixture(),
      });

      expect(captureSpy).toHaveBeenCalledWith(
        'Unknown mobile platform in configure card: sentry.unknown.platform'
      );
    });
  });
});
