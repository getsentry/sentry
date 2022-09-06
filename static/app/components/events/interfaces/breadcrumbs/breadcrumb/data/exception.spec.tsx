import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Exception} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/exception';
import ProjectStore from 'sentry/stores/projectsStore';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('Breadcrumb Data Exception', function () {
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

  ProjectStore.loadInitialData([project]);

  it('display redacted message', async function () {
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
          <Exception
            meta={{
              message: {
                '': {
                  rem: [['project:0', 's', 0, 0]],
                  len: 19,
                  chunks: [
                    {
                      type: 'redaction',
                      text: '',
                      rule_id: 'project:1',
                      remark: 's',
                    },
                  ],
                },
              },
            }}
            searchTerm=""
            breadcrumb={{
              type: BreadcrumbType.EXCEPTION,
              timestamp: '2017-08-04T07:52:11Z',
              level: BreadcrumbLevelType.INFO,
              message: '',
              category: 'started',
              data: {
                controller: '<sentry_ios_cocoapods.ViewController: 0x100e09ec0>',
              },
              event_id: null,
            }}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(
      screen.getByText('<sentry_ios_cocoapods.ViewController: 0x100e09ec0>')
    ).toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Replaced because of the PII rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
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
          <Exception
            meta={{
              data: {
                '': {
                  rem: [['project:0', 'x']],
                },
              },
            }}
            searchTerm=""
            breadcrumb={{
              type: BreadcrumbType.EXCEPTION,
              timestamp: '2017-08-04T07:52:11Z',
              level: BreadcrumbLevelType.INFO,
              message: '',
              category: 'started',
              data: null,
              event_id: null,
            }}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(
      screen.queryByText('<sentry_ios_cocoapods.ViewController: 0x100e09ec0>')
    ).not.toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Removed because of the PII rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
