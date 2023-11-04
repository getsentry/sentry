import {DataScrubbingRelayPiiConfig} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {Project} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Http} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/http';
import ProjectsStore from 'sentry/stores/projectsStore';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

describe('Breadcrumb Data Http', function () {
  const project = Project({id: '0'});

  const {organization, router} = initializeOrg({
    router: {
      location: {query: {project: project.id}},
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

  it('display redacted url', async function () {
    render(
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
      />,
      {organization, router}
    );

    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.queryByText('http://example.com/foo')).not.toBeInTheDocument();
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
      />,
      {organization, router}
    );

    expect(screen.queryByText('http://example.com/foo')).not.toBeInTheDocument();
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
