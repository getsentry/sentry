import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import type {RouterConfig} from 'sentry-test/reactTestingLibrary';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProfileHeader} from 'sentry/components/profiling/profileHeader';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {RequestState} from 'sentry/types/core';
import {ProfileContext} from 'sentry/views/explore/profiling/profilesProvider';
import {TopBar} from 'sentry/views/navigation/topBar';

jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => jest.fn(),
}));

// Transaction profile IDs are dash-less 32-char hex. The continuous profile
// spec covers the dashed-uuid shape, pinning that truncation ignores both.
const PROFILE_ID = 'a1f7cc43c19e4343874ab3c8a683518f';
const SHORT_PROFILE_ID = 'a1f7cc43';
const TRANSACTION_NAME = 'my-transaction';

const resolvedProfile = {
  type: 'resolved',
  data: {
    metadata: {transactionName: TRANSACTION_NAME},
    profiles: [],
    shared: {frames: []},
  },
} as unknown as RequestState<Profiling.ProfileInput>;

const transactionSpan = {
  trace: 'ff62a8b040f34bd7b3ac7f5c6d4d4d4d',
  span_id: 'aaaaaaaaaaaaaaaa',
  'precise.finish_ts': 1699999999,
};

/** Query params of a crumb's href, so assertions don't depend on key order. */
function queryOf(link: HTMLElement) {
  return new URLSearchParams(link.getAttribute('href')?.split('?')[1] ?? '');
}

describe('ProfileHeader', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '2', slug: 'foo-project'});

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  function renderHeader(
    options: {
      profile?: RequestState<Profiling.ProfileInput>;
      query?: Record<string, string>;
      span?: typeof transactionSpan;
    } = {}
  ) {
    const {
      profile = resolvedProfile,
      query = {project: project.id, environment: 'prod', statsPeriod: '7d'},
    } = options;
    // A destructuring default would swallow an explicit `span: undefined`, which
    // is exactly the case the no-linked-transaction test needs to exercise.
    const span = 'span' in options ? options.span : transactionSpan;
    const pathname = `/organizations/${organization.slug}/explore/profiles/profile/${project.slug}/${PROFILE_ID}/flamegraph/`;
    const initialRouterConfig: RouterConfig = {location: {pathname, query}};

    return render(
      <TopBar.Slot.Provider>
        <TopBar />
        <ProfileContext value={profile}>
          <ProfileHeader
            eventId={PROFILE_ID}
            projectId={project.slug}
            transactionSpan={span}
          />
        </ProfileContext>
      </TopBar.Slot.Provider>,
      {organization, initialRouterConfig}
    );
  }

  it('renders the parent trail with the profile ID as the page title', () => {
    renderHeader();

    const topBar = screen.getByRole('banner');
    const trail = within(topBar).getByRole('list');
    expect(within(trail).getByRole('link', {name: 'Profiles'})).toBeInTheDocument();
    expect(within(trail).getByRole('link', {name: TRANSACTION_NAME})).toBeInTheDocument();

    // The title outlet owns the page's single <h1>; the ID is shown truncated.
    const heading = within(topBar).getByRole('heading', {level: 1});
    expect(within(heading).getByText(SHORT_PROFILE_ID)).toBeInTheDocument();

    // The leaf must not also render inside the parent trail.
    expect(within(trail).queryByText(SHORT_PROFILE_ID)).not.toBeInTheDocument();
    expect(within(trail).queryByText(PROFILE_ID)).not.toBeInTheDocument();
  });

  it('collapses the page actions into a single title menu', async () => {
    renderHeader();

    const topBar = screen.getByRole('banner');
    // Go to Trace no longer stands alone in the actions slot.
    expect(
      within(topBar).queryByRole('button', {name: 'Go to Trace'})
    ).not.toBeInTheDocument();

    await userEvent.click(within(topBar).getByRole('button', {name: 'Profile Actions'}));

    // Order is the thing a reviewer cannot see in the diff.
    expect(
      screen.getAllByRole('menuitemradio').map(el => el.textContent?.trim())
    ).toEqual(['Copy profile ID to clipboard', 'Open Trace']);
  });

  it('omits Open Trace when there is no linked transaction', async () => {
    renderHeader({span: undefined});

    await userEvent.click(
      within(screen.getByRole('banner')).getByRole('button', {name: 'Profile Actions'})
    );

    expect(
      screen.getByRole('menuitemradio', {name: 'Copy profile ID to clipboard'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Open Trace'})
    ).not.toBeInTheDocument();
  });

  it('renders the project badge as a decorative graphic only', () => {
    renderHeader();

    // The 16x16 leading slot is aria-hidden. A ProjectBadge without
    // `disableLink` renders a tabbable anchor inside it — an aria-hidden-focus
    // violation that typechecks and slips past every role-based query.
    const topBar = screen.getByRole('banner');
    expect(topBar.querySelectorAll('[aria-hidden="true"] a')).toHaveLength(0);
  });

  it('preserves the page filters on the Profiles link', () => {
    renderHeader();

    const topBar = screen.getByRole('banner');
    const trail = within(topBar).getByRole('list');
    const profilesLink = within(trail).getByRole('link', {name: 'Profiles'});
    expect(profilesLink).toHaveAttribute(
      'href',
      expect.stringContaining(`/organizations/${organization.slug}/explore/profiles/`)
    );

    const params = queryOf(profilesLink);
    expect(params.get('project')).toBe(project.id);
    expect(params.get('environment')).toBe('prod');
    expect(params.get('statsPeriod')).toBe('7d');
  });

  it('points the transaction crumb at the transaction summary profiles tab', () => {
    renderHeader();

    const topBar = screen.getByRole('banner');
    const trail = within(topBar).getByRole('list');
    const transactionLink = within(trail).getByRole('link', {name: TRANSACTION_NAME});
    expect(transactionLink).toHaveAttribute(
      'href',
      expect.stringContaining('/summary/profiles/')
    );

    const params = queryOf(transactionLink);
    expect(params.get('transaction')).toBe(TRANSACTION_NAME);
    // The profile's own project wins over whatever is in the URL.
    expect(params.get('project')).toBe(project.id);
    expect(params.get('environment')).toBe('prod');
    expect(params.get('statsPeriod')).toBe('7d');
  });

  it("does not leak this page's search params onto the crumbs", () => {
    renderHeader({
      query: {
        project: project.id,
        query: 'transaction:foo',
        cursor: '0:0:1',
        sorting: 'call order',
      },
    });

    const topBar = screen.getByRole('banner');
    const trail = within(topBar).getByRole('list');
    for (const name of ['Profiles', TRANSACTION_NAME]) {
      const params = queryOf(within(trail).getByRole('link', {name}));
      expect(params.get('query')).toBeNull();
      expect(params.get('cursor')).toBeNull();
      expect(params.get('sorting')).toBeNull();
    }
  });

  it('forwards an absolute date range, which is a real page filter here', () => {
    renderHeader({
      query: {
        project: project.id,
        start: '2024-03-01T12:00:00.000Z',
        end: '2024-03-08T12:00:00.000Z',
      },
    });

    // This route does not inject the profile's time window into start/end the
    // way the continuous one does, so a range here belongs to the viewer.
    const trail = within(screen.getByRole('banner')).getByRole('list');
    const params = queryOf(within(trail).getByRole('link', {name: 'Profiles'}));
    expect(params.get('start')).toBe('2024-03-01T12:00:00.000Z');
    expect(params.get('end')).toBe('2024-03-08T12:00:00.000Z');
  });

  it('drops the transaction crumb until the profile resolves', () => {
    renderHeader({profile: {type: 'loading'}});

    const topBar = screen.getByRole('banner');
    const trail = within(topBar).getByRole('list');
    expect(within(trail).getByRole('link', {name: 'Profiles'})).toBeInTheDocument();
    expect(
      within(trail).queryByRole('link', {name: TRANSACTION_NAME})
    ).not.toBeInTheDocument();
    // The title is URL-derived, so it is stable while the profile loads.
    expect(
      within(within(topBar).getByRole('heading', {level: 1})).getByText(SHORT_PROFILE_ID)
    ).toBeInTheDocument();
  });
});
