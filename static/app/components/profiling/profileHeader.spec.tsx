import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import type {RouterConfig} from 'sentry-test/reactTestingLibrary';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProfileHeader} from 'sentry/components/profiling/profileHeader';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TopBar} from 'sentry/views/navigation/topBar';

const PROFILE_ID = 'a1f7cc43c19e4343874ab3c8a683518f';
const SHORT_PROFILE_ID = 'a1f7cc43';
const PROFILER_ID = '4d5e6f7a-8b9c-4d1e-9f2a-3b4c5d6e7f80';
const SHORT_PROFILER_ID = '4d5e6f7a';
const TRANSACTION_NAME = 'my-transaction';

const transactionSpan = {
  trace: 'ff62a8b040f34bd7b3ac7f5c6d4d4d4d',
  span_id: 'aaaaaaaaaaaaaaaa',
  'precise.finish_ts': 1699999999,
};

interface RenderOptions {
  profileId?: string;
  query?: Record<string, string>;
  span?: typeof transactionSpan;
  transactionName?: string;
  variant?: 'continuous' | 'transaction';
}

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

  function renderHeader(options: RenderOptions = {}) {
    const {
      profileId = PROFILE_ID,
      query = {project: project.id, environment: 'prod', statsPeriod: '7d'},
      transactionName = TRANSACTION_NAME,
      variant = 'transaction',
    } = options;
    const span = 'span' in options ? options.span : transactionSpan;

    const pathname = `/organizations/${organization.slug}/explore/profiles/profile/${project.slug}/flamegraph/`;
    const initialRouterConfig: RouterConfig = {location: {pathname, query}};

    return render(
      <TopBar.Slot.Provider>
        <TopBar />
        <ProfileHeader
          profileId={profileId}
          projectId={project.slug}
          transactionName={transactionName}
          transactionSpan={span}
          variant={variant}
        />
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

    const heading = within(topBar).getByRole('heading', {level: 1});
    expect(within(heading).getByText(SHORT_PROFILE_ID)).toBeInTheDocument();

    expect(within(trail).queryByText(SHORT_PROFILE_ID)).not.toBeInTheDocument();
    expect(within(trail).queryByText(PROFILE_ID)).not.toBeInTheDocument();
  });

  it('collapses the page actions into a single title menu', async () => {
    renderHeader();

    const topBar = screen.getByRole('banner');
    expect(
      within(topBar).queryByRole('button', {name: 'Go to Trace'})
    ).not.toBeInTheDocument();

    await userEvent.click(within(topBar).getByRole('button', {name: 'Profile Actions'}));

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

    // A ProjectBadge without `disableLink` puts a tabbable anchor inside the
    // aria-hidden slot, which no role-based query would catch.
    const topBar = screen.getByRole('banner');
    expect(topBar.querySelectorAll('[aria-hidden="true"] a')).toHaveLength(0);
  });

  it('preserves the page filters on the Profiles link', () => {
    renderHeader();

    const trail = within(screen.getByRole('banner')).getByRole('list');
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

    const trail = within(screen.getByRole('banner')).getByRole('list');
    const transactionLink = within(trail).getByRole('link', {name: TRANSACTION_NAME});
    expect(transactionLink).toHaveAttribute(
      'href',
      expect.stringContaining('/summary/profiles/')
    );

    const params = queryOf(transactionLink);
    expect(params.get('transaction')).toBe(TRANSACTION_NAME);
    expect(params.get('project')).toBe(project.id);
    expect(params.get('environment')).toBe('prod');
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

    const trail = within(screen.getByRole('banner')).getByRole('list');
    for (const name of ['Profiles', TRANSACTION_NAME]) {
      const params = queryOf(within(trail).getByRole('link', {name}));
      expect(params.get('query')).toBeNull();
      expect(params.get('cursor')).toBeNull();
      expect(params.get('sorting')).toBeNull();
    }
  });

  it('drops the transaction crumb until the name resolves', () => {
    renderHeader({transactionName: ''});

    const topBar = screen.getByRole('banner');
    const trail = within(topBar).getByRole('list');
    expect(within(trail).getByRole('link', {name: 'Profiles'})).toBeInTheDocument();
    expect(
      within(trail).queryByRole('link', {name: TRANSACTION_NAME})
    ).not.toBeInTheDocument();
    expect(
      within(within(topBar).getByRole('heading', {level: 1})).getByText(SHORT_PROFILE_ID)
    ).toBeInTheDocument();
  });

  describe('transaction variant', () => {
    it('forwards an absolute date range, which is a real page filter here', () => {
      renderHeader({
        query: {
          project: project.id,
          start: '2024-03-01T12:00:00.000Z',
          end: '2024-03-08T12:00:00.000Z',
        },
      });

      const trail = within(screen.getByRole('banner')).getByRole('list');
      const params = queryOf(within(trail).getByRole('link', {name: 'Profiles'}));
      expect(params.get('start')).toBe('2024-03-01T12:00:00.000Z');
      expect(params.get('end')).toBe('2024-03-08T12:00:00.000Z');
    });
  });

  describe('continuous variant', () => {
    it('titles the page with the profiler ID', async () => {
      renderHeader({profileId: PROFILER_ID, variant: 'continuous'});

      const topBar = screen.getByRole('banner');
      expect(
        within(within(topBar).getByRole('heading', {level: 1})).getByText(
          SHORT_PROFILER_ID
        )
      ).toBeInTheDocument();

      await userEvent.click(
        within(topBar).getByRole('button', {name: 'Profile Actions'})
      );
      expect(
        screen.getByRole('menuitemradio', {name: 'Copy profiler ID to clipboard'})
      ).toBeInTheDocument();
    });

    it('does not forward the profile time window to the crumbs', () => {
      renderHeader({
        profileId: PROFILER_ID,
        variant: 'continuous',
        query: {
          project: project.id,
          environment: 'prod',
          start: '2024-03-01T12:00:00.000Z',
          end: '2024-03-01T12:00:03.000Z',
          utc: 'true',
        },
      });

      const trail = within(screen.getByRole('banner')).getByRole('list');
      for (const name of ['Profiles', TRANSACTION_NAME]) {
        const params = queryOf(within(trail).getByRole('link', {name}));
        expect(params.get('start')).toBeNull();
        expect(params.get('end')).toBeNull();
        expect(params.get('utc')).toBeNull();
        expect(params.get('project')).toBe(project.id);
        expect(params.get('environment')).toBe('prod');
      }
    });
  });
});
