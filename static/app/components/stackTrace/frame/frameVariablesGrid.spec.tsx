import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';
import {OrganizationContext} from 'sentry/utils/organizationContext';

describe('FrameVariablesGrid', () => {
  it('switches the complete variable experience with the organization flag', () => {
    const organization = OrganizationFixture({features: []});
    const data = {"'player'": {x: 1, y: 2}, count: 42};
    function Example({enabled}: {enabled: boolean}) {
      return (
        <OrganizationContext.Provider
          value={{
            ...organization,
            features: enabled ? ['native-variable-extraction'] : [],
          }}
        >
          <FrameVariablesGrid platform="node" data={data} />
        </OrganizationContext.Provider>
      );
    }
    const {rerender} = render(<Example enabled={false} />);

    expect(screen.getByText('player')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Copy .* value/})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Expand player'})).not.toBeInTheDocument();

    rerender(<Example enabled />);

    expect(screen.getByText('player')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy player value'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Collapse player'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('x')).toBeInTheDocument();

    rerender(<Example enabled={false} />);

    expect(screen.getByText('player')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Copy .* value/})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Collapse player'})
    ).not.toBeInTheDocument();
  });

  describe.each([false, true])('with the variable tree enabled: %s', enabled => {
    it('sorts and formats variable names without mutating the input', () => {
      const data = Object.freeze({zebra: null, "'alpha'": null, middle: null});
      render(<FrameVariablesGrid data={data} />, {
        organization: OrganizationFixture({
          features: enabled ? ['native-variable-extraction'] : [],
        }),
      });

      expect(
        screen.getAllByText(/^(alpha|middle|zebra)$/).map(element => element.textContent)
      ).toEqual(['alpha', 'middle', 'zebra']);
      expect(screen.queryByText("'alpha'")).not.toBeInTheDocument();
      expect(Object.keys(data)).toEqual(['zebra', "'alpha'", 'middle']);
    });

    it('renders nothing when there are no variables', () => {
      const {container} = render(<FrameVariablesGrid data={null} />, {
        organization: OrganizationFixture({
          features: enabled ? ['native-variable-extraction'] : [],
        }),
      });
      expect(container).toBeEmptyDOMElement();
    });
  });

  it.each([
    ['native', {count: '0x2a (int)'}, [['count', '0x2a (int)']]],
    [
      'python',
      {
        count: '18446744073709551615',
        active: 'True',
        empty: 'None',
        message: "'hello'",
        client: '<Client at 0x12345>',
      },
      [
        ['count', '18446744073709551615'],
        ['active', 'True'],
        ['empty', 'None'],
        ['message', 'hello'],
        ['client', '<Client at 0x12345>'],
      ],
    ],
    [
      'ruby',
      {active: 'false', empty: 'nil'},
      [
        ['active', 'false'],
        ['empty', 'nil'],
      ],
    ],
    [
      'php',
      {active: 'true', empty: 'null'},
      [
        ['active', 'true'],
        ['empty', 'null'],
      ],
    ],
    [
      'node',
      {empty: '<null>', missing: '<undefined>'},
      [
        ['empty', 'null'],
        ['missing', 'undefined'],
      ],
    ],
  ] as const)(
    'preserves %s SDK values when displayed and copied',
    async (platform, data, values) => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {clipboard: {writeText}});
      render(<FrameVariablesGrid platform={platform} data={data} />, {
        organization: OrganizationFixture({features: ['native-variable-extraction']}),
      });

      for (const [name, value] of values) {
        expect(screen.getByText(value)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: `Copy ${name} value`}));
        expect(writeText).toHaveBeenLastCalledWith(value);
      }
    }
  );

  it.each(['<null>', '<undefined>'])(
    'keeps a redacted %s sentinel redacted when displayed and copied',
    async value => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {clipboard: {writeText}});
      render(
        <FrameVariablesGrid
          platform="node"
          data={{token: value}}
          meta={{token: {'': {rem: [['!config', 'x']]}}}}
        />,
        {organization: OrganizationFixture({features: ['native-variable-extraction']})}
      );

      expect(screen.getByText('<redacted>')).toBeInTheDocument();
      expect(screen.queryByText(/^(null|undefined)$/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Copy token value'}));
      expect(writeText).toHaveBeenLastCalledWith('<redacted>');
    }
  );
});
