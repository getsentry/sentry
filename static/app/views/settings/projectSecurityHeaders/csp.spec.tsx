import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectCspReports from 'sentry/views/settings/projectSecurityHeaders/csp';

describe('ProjectCspReports', function () {
  const {project, organization, router} = initializeOrg();

  const projectUrl = `/projects/${organization.slug}/${project.slug}/`;
  const routeUrl = `/projects/${organization.slug}/${project.slug}/csp/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'GET',
      body: {
        options: {},
      },
    });
  });

  it('renders', function () {
    const {container} = render(
      <ProjectCspReports
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
        location={TestStubs.location({pathname: routeUrl})}
        params={{orgId: organization.slug, projectId: project.slug}}
      />
    );
    expect(container).toSnapshot();
  });

  it('can enable default ignored sources', function () {
    render(
      <ProjectCspReports
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
        location={TestStubs.location({pathname: routeUrl})}
        params={{orgId: organization.slug, projectId: project.slug}}
      />
    );

    const mock = MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'PUT',
    });

    expect(mock).not.toHaveBeenCalled();

    // Click Regenerate Token
    userEvent.click(screen.getByRole('checkbox', {name: 'Use default ignored sources'}));

    expect(mock).toHaveBeenCalledWith(
      projectUrl,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {
            'sentry:csp_ignored_sources_defaults': true,
          },
        },
      })
    );
  });

  it('can set additional ignored sources', function () {
    render(
      <ProjectCspReports
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
        location={TestStubs.location({pathname: routeUrl})}
        params={{orgId: organization.slug, projectId: project.slug}}
      />
    );

    const mock = MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'PUT',
    });

    expect(mock).not.toHaveBeenCalled();

    userEvent.type(
      screen.getByRole('textbox', {name: 'Additional ignored sources'}),
      'test\ntest2'
    );

    // Focus on other element, trigerring onBlur
    userEvent.tab();

    expect(mock).toHaveBeenCalledWith(
      projectUrl,
      expect.objectContaining({
        method: 'PUT',
        data: {
          // XXX: Org details endpoints accept these multiline inputs as a list, where as it looks like project details accepts it as a string with newlines
          options: {
            'sentry:csp_ignored_sources': `test\ntest2`,
          },
        },
      })
    );
  });
});
