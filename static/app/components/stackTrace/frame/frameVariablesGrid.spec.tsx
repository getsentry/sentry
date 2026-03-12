import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';
import {ProjectsStore} from 'sentry/stores/projectsStore';

describe('FrameVariablesGrid', () => {
  it('renders variables sorted alphabetically', () => {
    render(
      <FrameVariablesGrid
        data={{
          zebra: null,
          alpha: null,
          middle: null,
        }}
      />
    );

    const keys = screen.getAllByText(/^(alpha|middle|zebra)$/);
    expect(keys[0]).toHaveTextContent('alpha');
    expect(keys[1]).toHaveTextContent('middle');
    expect(keys[2]).toHaveTextContent('zebra');
  });

  it('strips quotes from variable keys', () => {
    render(
      <FrameVariablesGrid
        data={{
          "'quoted'": 'value',
          unquoted: 'value',
        }}
      />
    );

    expect(screen.getByText('quoted')).toBeInTheDocument();
    expect(screen.getByText('unquoted')).toBeInTheDocument();
  });

  it('renders null when data is null', () => {
    const {container} = render(<FrameVariablesGrid data={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders meta annotations with tooltips for filtered values', async () => {
    const organization = OrganizationFixture();
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

    const initialRouterConfig = {
      location: {
        pathname: `/organizations/org-slug/issues/1/`,
        query: {project: project.id},
      },
      route: '/organizations/:orgId/issues/:groupId/',
    };

    render(
      <FrameVariablesGrid
        data={{
          "'client'": '',
          "'data'": null,
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
        }}
      />,
      {organization, initialRouterConfig}
    );

    expect(screen.getByText(/redacted/)).toBeInTheDocument();

    await userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders python variables correctly', () => {
    render(
      <FrameVariablesGrid
        data={{
          null_val: 'None',
          bool_val: 'True',
          str_val: "'string'",
          number_val: '123.45',
          other_val: '<Class at 0x12345>',
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

  it('does not mutate the data prop', () => {
    const data = {
      zebra: 'last',
      alpha: 'first',
      middle: 'middle',
    };
    const originalKeys = Object.keys(data);

    render(<FrameVariablesGrid data={data} />);

    expect(Object.keys(data)).toEqual(originalKeys);
  });
});
