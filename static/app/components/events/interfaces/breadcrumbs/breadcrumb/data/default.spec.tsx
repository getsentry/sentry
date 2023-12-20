import {DataScrubbingRelayPiiConfig} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {Event as EventFixture} from 'sentry-fixture/event';
import {Project} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Default} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/default';
import ProjectsStore from 'sentry/stores/projectsStore';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

describe('Breadcrumb Data Default', function () {
  const project = Project({
    id: '0',
  });

  const {organization, router} = initializeOrg({
    router: {
      location: {query: {project: '0'}},
    },
    projects: [project],
  });

  beforeEach(() => {
    const projectDetails = Project({
      ...project,
      relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfig()),
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      body: projectDetails,
    });
    ProjectsStore.loadInitialData([project]);
  });

  it('display redacted message', async function () {
    render(
      <Default
        meta={{
          message: {
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
        }}
        event={EventFixture()}
        orgSlug="org-slug"
        searchTerm=""
        breadcrumb={{
          type: BreadcrumbType.DEBUG,
          timestamp: '2017-08-04T07:52:11Z',
          level: BreadcrumbLevelType.INFO,
          message: '',
          category: 'started',
          data: {
            controller: '<sentry_ios_cocoapods.ViewController: 0x100e09ec0>',
          },
          event_id: null,
        }}
      />,
      {
        organization,
        router,
      }
    );

    expect(
      screen.getByText('<sentry_ios_cocoapods.ViewController: 0x100e09ec0>')
    ).toBeInTheDocument();
    await userEvent.hover(screen.getByText(/redacted/));
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
      <Default
        meta={{
          data: {
            '': {
              rem: [['project:0', 'x']],
            },
          },
        }}
        event={EventFixture()}
        orgSlug="org-slug"
        searchTerm=""
        breadcrumb={{
          type: BreadcrumbType.DEBUG,
          timestamp: '2017-08-04T07:52:11Z',
          level: BreadcrumbLevelType.INFO,
          message: '',
          category: 'started',
          data: null,
          event_id: null,
        }}
      />,
      {organization, router}
    );

    expect(
      screen.queryByText('<sentry_ios_cocoapods.ViewController: 0x100e09ec0>')
    ).not.toBeInTheDocument();
    await userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Removed because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
