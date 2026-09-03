import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {ConfigStore} from 'sentry/stores/configStore';
import {useReplayMenuItems} from 'sentry/views/explore/replays/detail/header/useReplayMenuItems';

function findItem(items: MenuItemProps[], key: string): MenuItemProps | undefined {
  for (const item of items) {
    if (item.key === key) {
      return item;
    }
    const nested = item.children && findItem(item.children, key);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

/**
 * The shape the breadcrumbs pass for a replay with processing errors: the
 * reader is withheld so the actions needing its frames disable themselves,
 * but `isMobile` still reflects what the replay actually is.
 */
function renderMenuItems(isMobile: boolean) {
  const {result} = renderHookWithProviders(useReplayMenuItems, {
    organization: OrganizationFixture(),
    initialProps: {
      isMobile,
      projectSlug: 'project-slug',
      replay: undefined,
      replayRecord: ReplayRecordFixture({sdk: {name: 'sentry.cocoa', version: '8.0.0'}}),
    },
  });

  return result.current;
}

describe('useReplayMenuItems', () => {
  beforeEach(() => {
    ConfigStore.set(
      'user',
      UserFixture({
        emails: [{id: '1', email: 'someone@sentry.io', is_verified: true}],
      })
    );
  });

  it('offers the video-segment download disabled, not hidden, when the reader is withheld', () => {
    const videoItem = findItem(renderMenuItems(true), 'download-1st-video');

    // The action applies — this really is a mobile replay — it just cannot run
    // until the frames are readable.
    expect(videoItem).toBeDefined();
    expect(videoItem?.disabled).toBe(true);
  });

  it('omits the video-segment download for a web replay', () => {
    // Not applicable rather than unavailable, so it is absent entirely.
    expect(findItem(renderMenuItems(false), 'download-1st-video')).toBeUndefined();
  });

  it('links the mobile configuration docs for a mobile replay', () => {
    const general = findItem(renderMenuItems(true), 'general');

    expect(general?.externalHref).toContain('/apple/guides/ios/');
  });

  it('links the web configuration docs for a web replay', () => {
    const general = findItem(renderMenuItems(false), 'general');

    expect(general?.externalHref).toContain('/javascript/');
  });
});
