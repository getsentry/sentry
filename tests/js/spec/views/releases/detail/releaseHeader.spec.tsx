import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {PlatformKey} from 'app/data/platformCategories';
import EventView from 'app/utils/discover/eventView';
import {DEFAULT_EVENT_VIEW} from 'app/views/eventsV2/data';
import ReleaseHeader from 'app/views/releases/detail/releaseHeader';
import {
  getSessionTermDescription,
  SessionTerm,
  sessionTerm,
} from 'app/views/releases/utils/sessionTerm';

describe('ReleaseHeader', function () {
  const {organization} = initializeOrg();
  // @ts-ignore Cannot find name TestStubs
  const release = TestStubs.Release();
  // @ts-ignore Cannot find name TestStubs
  const location = TestStubs.location();
  // @ts-ignore Cannot find name TestStubs
  const routerContext = TestStubs.routerContext();

  const eventView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
  const platform: PlatformKey = 'javascript';

  it('renders release header', function () {
    const wrapper = mountWithTheme(
      <ReleaseHeader
        location={location}
        organization={organization}
        releaseEventView={eventView}
        release={release}
        project={{...release.projects[0], platform}}
        releaseMeta={{
          commitCount: 0,
          commitFilesChanged: 0,
          deployCount: 0,
          version: 'sentry-android-shop@1.2.0',
          projects: release.projects,
          versionInfo: {
            buildHash: null,
            version: {
              raw: '1.2.0',
            },
            description: '1.2.0',
            package: 'sentry-android-shop',
          },
          released: '2020-11-20T22:57:15.647000Z',
          releaseFileCount: 0,
        }}
        refetchData={jest.fn()}
      />,
      routerContext
    );

    const releaseStats = wrapper.find('ReleaseStat');
    const releaseStatsCrashes = releaseStats.at(1);

    const {label, help} = releaseStatsCrashes.props();

    expect(label).toEqual(sessionTerm.crashes);
    expect(help).toEqual(getSessionTermDescription(SessionTerm.CRASHES, platform));
  });
});
