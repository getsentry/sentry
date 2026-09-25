import MockDate from 'mockdate';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {resetMockDate} from 'sentry-test/utils';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import ProjectsDashboard from 'sentry/views/projectsDashboard';

jest.unmock('react-lazyload');

// JSDOM has no layout engine. Give the real lazy loader the geometry of a card
// below the fold, then move it into view when its scroll container scrolls.
describe('ProjectsDashboard lazy loading', () => {
  beforeEach(() => {
    // react-lazyload's debounce measures elapsed time with new Date().
    MockDate.reset();
  });

  afterEach(() => {
    resetMockDate();
    jest.restoreAllMocks();
    TeamStore.reset();
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it.each(['pane', 'window'] as const)(
    'fetches stats when a project enters the viewport on %s scroll',
    async scrollTarget => {
      const organization = OrganizationFixture({
        openMembership: true,
        features:
          scrollTarget === 'pane'
            ? ['gen-ai-features', 'seer-explorer', 'seer-explorer-persistent-sidebar']
            : [],
      });
      const team = TeamFixture();
      const project = ProjectFixture({
        teams: [team],
        firstEvent: '2026-01-01T00:00:00Z',
      });
      TeamStore.loadInitialData([team]);
      ProjectsStore.loadInitialData([project]);
      MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${team.slug}/members/`,
        body: [],
      });
      const statsRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [{...project, stats: [[1, 5]], transactionStats: []}],
      });

      let cardTop = 2000;
      jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(330);
      jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(400);
      jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          return new DOMRect(
            0,
            this.id === 'project-scroll-pane' ? 0 : cardTop,
            400,
            330
          );
        });

      render(
        <div
          id="project-scroll-pane"
          data-test-id="project-scroll-pane"
          style={
            scrollTarget === 'pane'
              ? {overflow: 'auto', overflowX: 'auto', overflowY: 'auto', height: 330}
              : undefined
          }
        >
          <ProjectsDashboard />
        </div>,
        {organization}
      );

      expect(await screen.findByText('My Teams')).toBeInTheDocument();
      expect(screen.queryByText(project.slug)).not.toBeInTheDocument();
      expect(statsRequest).not.toHaveBeenCalled();

      const pane = screen.getByTestId('project-scroll-pane');
      act(() => {
        cardTop = 100;
        (scrollTarget === 'pane' ? pane : window).dispatchEvent(
          new Event('scroll', {bubbles: false})
        );
      });

      expect(await screen.findByText(project.slug)).toBeInTheDocument();
      await waitFor(() => expect(statsRequest).toHaveBeenCalledTimes(1));
      expect(statsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({query: `id:${project.id}`, statsPeriod: '24h'}),
        })
      );
      expect(await screen.findByText('Errors: 5')).toBeInTheDocument();

      act(() => {
        cardTop = 2000;
        (scrollTarget === 'pane' ? pane : window).dispatchEvent(
          new Event('scroll', {bubbles: false})
        );
      });
      await waitFor(() =>
        expect(screen.queryByText(project.slug)).not.toBeInTheDocument()
      );
    }
  );
});
