import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import ProjectsStore from 'sentry/stores/projectsStore';
import AlertHeader from 'sentry/views/alerts/list/header';

describe('AlertHeader', () => {
  const project = ProjectFixture();
  const {organization} = initializeOrg();
  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '7d',
        start: null,
        end: null,
        utc: null,
      },
    });
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
  });

  it('should pass global selection project to create alert button', () => {
    render(<AlertHeader activeTab="stream" />, {
      organization,
    });
    expect(screen.getByRole('button', {name: 'Create Alert'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/alerts/wizard/?referrer=alert_stream&project=project-slug'
    );
  });
});
