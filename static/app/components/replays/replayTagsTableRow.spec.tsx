import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ReplayTagsTableRow from './replayTagsTableRow';

describe('ReplayTagsTableRow', () => {
  it('Should render tag key and value correctly', () => {
    render(<ReplayTagsTableRow name="foo" values={['bar', 'baz']} />);

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByText('baz')).toBeInTheDocument();
  });

  it('Should render release tags correctly', () => {
    render(<ReplayTagsTableRow name="release" values={['1.0.0', '2.0.0']} />);

    expect(screen.getByText('release')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('2.0.0')).toBeInTheDocument();
  });

  it('Should render the tag value as a link if we get a link result from generateUrl', () => {
    render(
      <ReplayTagsTableRow
        name="foo"
        values={['bar', 'baz']}
        generateUrl={(name, value) => ({pathname: '/home', query: {[name]: value}})}
      />,
      {context: RouterContextFixture()}
    );

    expect(screen.getByText('bar').closest('a')).toHaveAttribute('href', '/home?foo=bar');
    expect(screen.getByText('baz').closest('a')).toHaveAttribute('href', '/home?foo=baz');
  });

  it('Should render tags and values with spaces inside them', () => {
    render(
      <ReplayTagsTableRow
        name="foo bar"
        values={['biz baz']}
        generateUrl={(name, value) => ({pathname: '/home', query: {[name]: value}})}
      />,
      {context: RouterContextFixture()}
    );

    expect(screen.getByText('foo bar')).toBeInTheDocument();
    expect(screen.getByText('biz baz').closest('a')).toHaveAttribute(
      'href',
      '/home?foo%20bar=biz%20baz'
    );
  });
});
