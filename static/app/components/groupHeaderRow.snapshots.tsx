import {ThemeProvider} from '@emotion/react';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import type {LinkProps} from '@sentry/scraps/link';
import {LinkBehaviorContextProvider} from '@sentry/scraps/link';

import {EventOrGroupType} from 'sentry/types/event';
import {GroupStatus} from 'sentry/types/group';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

// SSR snapshot tests run in a bare Node env (no jsdom, no RTL render, no
// router context) so the store-based alternatives the lint rule suggests
// don't exist here.
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useLocation', () => ({
  useLocation: () => ({pathname: '/', query: {}, search: '', hash: ''}),
}));
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => () => {},
}));
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/components/pageFilters/usePageFilters', () => ({
  usePageFilters: () => ({
    selection: {datetime: {}, environments: [], projects: []},
    isReady: true,
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({prefetchQuery: () => Promise.resolve()}),
}));
jest.mock('@tanstack/react-pacer', () => ({
  useDebouncer: () => ({maybeExecute: () => {}, cancel: () => {}}),
}));
jest.mock('@react-aria/interactions', () => ({
  useHover: () => ({hoverProps: {}}),
}));
jest.mock('sentry/components/errorBoundary', () => ({
  ErrorBoundary: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('sentry/components/groupPreviewTooltip', () => ({
  GroupPreviewTooltip: ({children}: {children: React.ReactNode}) => children,
}));

import {GroupHeaderRow} from './groupHeaderRow';

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
  title: 'RequestError: GET /issues/ 404',
  metadata: {function: 'fetchData', type: 'RequestError'},
  culprit: 'fetchData(app/components/group/suggestedOwners)',
  type: EventOrGroupType.ERROR,
  level: 'error',
  project,
});

const bookmarkedGroup = GroupFixture({
  ...defaultGroup,
  isBookmarked: true,
});

const resolvedGroup = GroupFixture({
  id: '1337',
  title: 'RequestError: GET /issues/ 404',
  metadata: {function: 'fetchData', type: 'RequestError'},
  culprit: 'fetchData(app/components/group/suggestedOwners)',
  type: EventOrGroupType.ERROR,
  level: 'error',
  project,
  status: GroupStatus.RESOLVED,
});

describe('GroupHeaderRow', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot('default', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 600}}>
              <GroupHeaderRow data={defaultGroup} />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));

    it.snapshot('bookmarked', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 600}}>
              <GroupHeaderRow data={bookmarkedGroup} />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));

    it.snapshot('resolved', () => (
      <ThemeProvider theme={themes[themeName]}>
        <LinkBehaviorContextProvider value={ssrLinkBehavior}>
          <OrganizationContext value={organization}>
            <div style={{padding: 8, width: 600}}>
              <GroupHeaderRow data={resolvedGroup} />
            </div>
          </OrganizationContext>
        </LinkBehaviorContextProvider>
      </ThemeProvider>
    ));
  });
});
