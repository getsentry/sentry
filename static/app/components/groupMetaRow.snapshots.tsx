import {ThemeProvider} from '@emotion/react';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import type {LinkProps} from '@sentry/scraps/link';
import {LinkBehaviorContextProvider} from '@sentry/scraps/link';

import {EventOrGroupType} from 'sentry/types/event';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

// SSR snapshot tests — no jsdom/RTL/router, so we mock hooks directly.
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useLocation', () => ({
  useLocation: () => ({pathname: '/', query: {}, search: '', hash: ''}),
}));
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useOrganization', () => ({
  useOrganization: () => OrganizationFixture(),
}));
jest.mock('sentry/components/timeSince', () => ({
  TimeSince: ({tooltipPrefix}: {tooltipPrefix?: string}) => (
    <span>{tooltipPrefix ?? ''} 2d ago</span>
  ),
}));
jest.mock('sentry/components/group/issueReplayCount', () => ({
  IssueReplayCount: () => null,
}));
jest.mock('sentry/components/group/issueSeerBadge', () => ({
  IssueSeerBadge: () => null,
}));

import {GroupMetaRow} from './groupMetaRow';

const themes = {light: lightTheme, dark: darkTheme};
const organization = OrganizationFixture();

function SsrLink({to, children}: LinkProps) {
  return <a href={typeof to === 'string' ? to : '#'}>{children}</a>;
}

const ssrLinkBehavior = {
  component: SsrLink,
  behavior: (props: LinkProps) => props,
};

const project = ProjectFixture({slug: 'javascript', platform: 'javascript'});

const defaultGroup = GroupFixture({
  id: '1337',
  shortId: 'JAVASCRIPT-6QS',
  project,
  type: EventOrGroupType.ERROR,
  level: 'error',
  firstSeen: '2024-01-05T19:44:05.963Z',
  lastSeen: '2024-01-11T01:08:59Z',
  lifetime: {
    firstSeen: '2024-01-05T19:44:05.963Z',
    lastSeen: '2024-01-11T01:08:59Z',
    count: '12000',
    userCount: 350,
    stats: {},
  },
  numComments: 3,
  logger: 'sentry.tasks.store',
  isUnhandled: false,
  subscriptionDetails: {reason: 'mentioned'},
  annotations: [{url: 'https://jira.example.com/PROJ-123', displayName: 'PROJ-123'}],
});

const unhandledGroup = GroupFixture({
  id: '1337',
  shortId: 'JAVASCRIPT-6QS',
  project,
  type: EventOrGroupType.ERROR,
  level: 'error',
  firstSeen: '2024-01-05T19:44:05.963Z',
  lastSeen: '2024-01-11T01:08:59Z',
  lifetime: {
    firstSeen: '2024-01-05T19:44:05.963Z',
    lastSeen: '2024-01-11T01:08:59Z',
    count: '12000',
    userCount: 350,
    stats: {},
  },
  numComments: 3,
  logger: 'sentry.tasks.store',
  isUnhandled: true,
  subscriptionDetails: {reason: 'mentioned'},
  annotations: [{url: 'https://jira.example.com/PROJ-123', displayName: 'PROJ-123'}],
});

const minimalGroup = GroupFixture({
  id: '1338',
  shortId: 'JAVASCRIPT-ABC',
  project,
  type: EventOrGroupType.ERROR,
  numComments: 0,
  logger: null,
  annotations: [],
  isUnhandled: false,
  lifetime: undefined,
  firstSeen: '2024-01-10T00:00:00Z',
  lastSeen: '2024-01-10T00:00:00Z',
});

describe('GroupMetaRow', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot('full', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 700}}>
              <GroupMetaRow data={defaultGroup} />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));

    it.snapshot('unhandled', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 700}}>
              <GroupMetaRow data={unhandledGroup} />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));

    it.snapshot('minimal', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 700}}>
              <GroupMetaRow data={minimalGroup} />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));

    it.snapshot('with-assignee', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 700}}>
              <GroupMetaRow
                data={GroupFixture({
                  id: '1337',
                  shortId: 'JAVASCRIPT-6QS',
                  project,
                  assignedTo: {
                    id: '1',
                    name: 'Jane Doe',
                    type: 'user',
                    email: 'jane@example.com',
                  },
                })}
                showAssignee
              />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));

    it.snapshot('no-lifetime', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 700}}>
              <GroupMetaRow data={defaultGroup} showLifetime={false} />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));

    it.snapshot('mentioned-comment', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 700}}>
              <GroupMetaRow
                data={GroupFixture({
                  id: '1337',
                  shortId: 'JAVASCRIPT-6QS',
                  project,
                  numComments: 5,
                  subscriptionDetails: {reason: 'mentioned'},
                })}
              />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));
  });
});
