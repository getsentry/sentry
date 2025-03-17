import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {FrameVariables} from 'sentry/components/events/interfaces/frame/frameVariables';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('Frame Variables', function () {
  it('renders', async function () {
    const project = ProjectFixture({id: '0'});
    const projectDetails = ProjectFixture({
      ...project,
      relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      body: projectDetails,
    });
    ProjectsStore.loadInitialData([project]);

    const {organization, router} = initializeOrg({
      router: {
        location: {query: {project: project.id}},
      },
      projects: [project],
    });

    render(
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
      />,
      {organization, router}
    );

    expect(screen.getAllByText(/redacted/)).toHaveLength(2);

    await userEvent.hover(screen.getAllByText(/redacted/)[0]!);

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

  it('renders python variables correctly', function () {
    render(
      <FrameVariables
        data={{
          null: 'None',
          bool: 'True',
          str: "'string'",
          number: '123.45',
          other: '<Class at 0x12345>',
        }}
        platform="python"
      />
    );

    expect(
      within(screen.getByTestId('value-null')).getByText('None')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-boolean')).getByText('True')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-string')).getByText('"string"')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-number')).getByText('123.45')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-unformatted')).getByText('<Class at 0x12345>')
    ).toBeInTheDocument();
  });

  it('renders node variables correctly', function () {
    render(
      <FrameVariables
        data={{
          null: '<null>',
          undefined: '<undefined>',
          bool: true,
          number: 123.45,
          str: 'string',
        }}
        platform="node"
      />
    );

    const nullValues = screen.getAllByTestId('value-null');

    expect(within(nullValues[0]!).getByText('null')).toBeInTheDocument();
    expect(within(nullValues[1]!).getByText('undefined')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-boolean')).getByText('true')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-number')).getByText('123.45')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-unformatted')).getByText('string')
    ).toBeInTheDocument();
  });

  it('renders ruby variables correctly', function () {
    render(
      <FrameVariables
        data={{
          null: 'nil',
          bool: 'true',
          str: 'string',
        }}
        platform="ruby"
      />
    );

    expect(within(screen.getByTestId('value-null')).getByText('nil')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-boolean')).getByText('true')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-unformatted')).getByText('string')
    ).toBeInTheDocument();
  });

  it('renders php variables correctly', function () {
    render(
      <FrameVariables
        data={{
          null: 'null',
          bool: 'true',
          str: 'string',
        }}
        platform="php"
      />
    );

    expect(
      within(screen.getByTestId('value-null')).getByText('null')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-boolean')).getByText('true')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('value-unformatted')).getByText('string')
    ).toBeInTheDocument();
  });
});
