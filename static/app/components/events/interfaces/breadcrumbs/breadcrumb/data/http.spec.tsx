import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Http} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/http';
import ProjectsStore from 'sentry/stores/projectsStore';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('Breadcrumb Data Http', function () {
  const project = TestStubs.Project({
    id: '0',
    relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
  });

  const {organization, router} = initializeOrg({
    ...initializeOrg(),
    router: {
      location: {query: {project: '0'}},
    },
    project: '0',
    projects: [project],
  });

  ProjectsStore.loadInitialData([project]);

  it('display redacted url', async function () {
    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <Http
            meta={{
              data: {
                url: {
                  '': {
                    rem: [['project:0', 's', 0, 0]],
                    len: 19,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'project:0',
                        remark: 's',
                      },
                    ],
                  },
                },
              },
            }}
            searchTerm=""
            breadcrumb={{
              type: BreadcrumbType.HTTP,
              level: BreadcrumbLevelType.INFO,
              data: {
                method: 'POST',
                url: '',
                status_code: 0,
              },
            }}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.queryByText('http://example.com/foo')).not.toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });

  it('display redacted data', async function () {
    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <Http
            meta={{
              data: {
                '': {
                  rem: [['project:0', 'x']],
                },
              },
            }}
            searchTerm=""
            breadcrumb={{
              type: BreadcrumbType.HTTP,
              level: BreadcrumbLevelType.INFO,
              data: null,
            }}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.queryByText('http://example.com/foo')).not.toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Removed because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
