import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {hasLogsOnReplays} from './hasLogsOnReplays';

describe('hasLogsOnReplays', () => {
  const organization = OrganizationFixture({features: ['ourlogs-enabled']});
  const project = ProjectFixture({hasLogs: true});

  it.each([
    ['sentry.cocoa', '8.57.0', false],
    ['sentry.cocoa', '9.0.0-alpha', false],
    ['sentry.cocoa', '9.0.0-alpha.0', true],
    ['sentry.cocoa', '9.0.0-beta.1', true],
    ['sentry.cocoa', '9.0.0', true],
    ['sentry.cocoa', '9.24.0', true],
    ['sentry.cocoa', '10.0.0', true],
    ['sentry.cocoa', null, false],
    ['sentry.cocoa', '', false],
    ['sentry.javascript.browser', '7.1.1', true],
    ['sentry.javascript.browser', null, true],
    ['sentry.java.android', '8.0.0', true],
    [null, '9.24.0', false],
    ['', '9.24.0', false],
  ])('%s %s: logs support is %s', (name, version, expected) => {
    const replay = ReplayRecordFixture({sdk: {name, version}});

    expect(hasLogsOnReplays(organization, project, replay)).toBe(expected);
  });

  it('requires logs to be enabled for the organization', () => {
    expect(hasLogsOnReplays(OrganizationFixture(), project, ReplayRecordFixture())).toBe(
      false
    );
  });

  it('requires logs in the project', () => {
    expect(
      hasLogsOnReplays(
        organization,
        ProjectFixture({hasLogs: false}),
        ReplayRecordFixture()
      )
    ).toBe(false);
  });

  it('requires a project', () => {
    expect(hasLogsOnReplays(organization, null, ReplayRecordFixture())).toBe(false);
  });

  it('requires a replay', () => {
    expect(hasLogsOnReplays(organization, project, null)).toBe(false);
  });
});
