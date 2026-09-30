import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';

describe('FrameVariablesGrid', () => {
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
});
