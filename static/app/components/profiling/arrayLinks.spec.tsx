import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ArrayLinks} from 'sentry/components/profiling/arrayLinks';

describe('ArrayLinks', function () {
  it('renders single item', function () {
    render(<ArrayLinks items={[{target: '/foo', value: 'foo'}]} />);
    expect(screen.getByText('foo')).toBeInTheDocument();
  });

  it('renders two items', async function () {
    render(
      <ArrayLinks
        items={[
          {target: '/foo', value: 'foo'},
          {target: '/bar', value: 'bar'},
        ]}
      />
    );

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.queryByText('bar')).not.toBeInTheDocument();
    expect(screen.getByText('[+1 more]')).toBeInTheDocument();
    expect(screen.queryByText('[collapse]')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('[+1 more]'));
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.queryByText('[+1 more]')).not.toBeInTheDocument();
    expect(screen.getByText('[collapse]')).toBeInTheDocument();

    await userEvent.click(screen.getByText('[collapse]'));
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.queryByText('bar')).not.toBeInTheDocument();
    expect(screen.getByText('[+1 more]')).toBeInTheDocument();
    expect(screen.queryByText('[collapse]')).not.toBeInTheDocument();
  });
});
