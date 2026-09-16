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

  it('returns a disabled video-segment item when the replay reader is unavailable', () => {
    const videoItem = findItem(renderMenuItems(true), 'download-1st-video');

    expect(videoItem).toMatchObject({
      key: 'download-1st-video',
      disabled: true,
    });
  });

  it('omits the video-segment download for a web replay', () => {
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
