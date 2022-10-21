import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {FrameVariables} from 'sentry/components/events/interfaces/frame/frameVariables';
import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('Frame Variables', function () {
  it('renders', async function () {
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
          <FrameVariables
            data={{
              "'client'": '',
              "'data'": null,
              "'k'": '',
              "'options'": {
                "'data'": null,
                "'tags'": null,
              },
            }}
            meta={{
              "'client'": {
                '': {
                  rem: [['project:0', 's', 0, 0]],
                  len: 41,
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
              "'k'": {
                '': {
                  rem: [['project:0', 's', 0, 0]],
                  len: 12,
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
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getAllByText(/redacted/)).toHaveLength(2);

    userEvent.hover(screen.getAllByText(/redacted/)[0]);

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
        )
      )
    ).toBeInTheDocument(); // tooltip description

    expect(
      screen.getByRole('link', {
        name: '[Replace] [Password fields] with [Scrubbed] from [password]',
      })
    ).toHaveAttribute(
      'href',
      '/settings/org-slug/projects/project-slug/security-and-privacy/advanced-data-scrubbing/0/'
    );

    expect(screen.getByRole('link', {name: 'project-slug'})).toHaveAttribute(
      'href',
      '/settings/org-slug/projects/project-slug/security-and-privacy/'
    );
  });
});
