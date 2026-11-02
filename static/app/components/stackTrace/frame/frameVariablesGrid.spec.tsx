import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';
import {ProjectsStore} from 'sentry/stores/projectsStore';

describe('FrameVariablesGrid', () => {
  it('renders proposed native payloads with type labels and formatted values', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {writeText}});
    render(
      <FrameVariablesGrid
        platform="native"
        data={{
          argc: {kind: 'parameter', type: 'int', formatted: '0x2'},
          player: {kind: 'local', type: 'Player *', formatted: null},
          token: {kind: 'local', type: 'char *', formatted: null},
          legacy: '0x1 (int)',
        }}
        meta={{token: {formatted: {'': {rem: [['!config', 'x']]}}}}}
      />,
      {organization: OrganizationFixture({features: ['native-variable-extraction']})}
    );

    expect(screen.getByText('int')).toBeInTheDocument();
    expect(screen.getByText('Player *')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('<redacted>')).toBeInTheDocument();
    expect(screen.getByText('0x1 (int)')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy player value'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy token value'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Copy argc value'}));
    expect(writeText).toHaveBeenCalledWith('0x2');
  });

  it('uses the legacy renderer without the variable extraction flag', () => {
    render(<FrameVariablesGrid platform="node" data={{"'player'": {x: 1, y: 2}}} />, {
      organization: OrganizationFixture({features: []}),
    });

    expect(screen.getByText('player')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Copy .* value/})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /Expand player|Collapse player/})
    ).not.toBeInTheDocument();
  });

  it('uses the tree when the variable extraction flag is enabled', () => {
    render(<FrameVariablesGrid platform="node" data={{"'player'": {x: 1, y: 2}}} />, {
      organization: OrganizationFixture({features: ['native-variable-extraction']}),
    });

    expect(screen.getByText('player')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy player value'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Collapse player'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('x')).toBeInTheDocument();
  });

  it('sorts and formats variable names without mutating the input', () => {
    const data = Object.freeze({zebra: null, "'alpha'": null, middle: null});
    render(<FrameVariablesGrid data={data} />, {
      organization: OrganizationFixture({features: ['native-variable-extraction']}),
    });

    expect(
      screen.getAllByText(/^(alpha|middle|zebra)$/).map(element => element.textContent)
    ).toEqual(['alpha', 'middle', 'zebra']);
    expect(Object.keys(data)).toEqual(['zebra', "'alpha'", 'middle']);
  });

  it('renders nothing when there are no variables', () => {
    const {container} = render(<FrameVariablesGrid data={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('preserves large Python numbers when displayed and copied', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {writeText}});
    render(
      <FrameVariablesGrid platform="python" data={{count: '18446744073709551615'}} />,
      {organization: OrganizationFixture({features: ['native-variable-extraction']})}
    );

    expect(screen.getByText('18446744073709551615')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Copy count value'}));
    expect(writeText).toHaveBeenLastCalledWith('18446744073709551615');
  });

  it('shows a redacted Node sentinel without a copy button', () => {
    render(
      <FrameVariablesGrid
        platform="node"
        data={{token: '<undefined>'}}
        meta={{token: {'': {rem: [['!config', 'x']]}}}}
      />,
      {organization: OrganizationFixture({features: ['native-variable-extraction']})}
    );

    expect(screen.getByText('<redacted>')).toBeInTheDocument();
    expect(screen.queryByText(/^(null|undefined)$/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy token value'})
    ).not.toBeInTheDocument();
  });

  it('renders meta annotations with tooltips for filtered values', async () => {
    const organization = OrganizationFixture();
    const project = DetailedProjectFixture({id: '0'});
    const projectDetails = DetailedProjectFixture({
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
        pathname: '/organizations/org-slug/issues/1/',
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

  it('renders node variables correctly', () => {
    render(
      <FrameVariablesGrid
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

  it('renders ruby variables correctly', () => {
    render(
      <FrameVariablesGrid
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

  it('renders php variables correctly', () => {
    render(
      <FrameVariablesGrid
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
