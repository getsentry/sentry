import {render, screen} from 'sentry-test/reactTestingLibrary';

import ReplayTagsTableRow from './replayTagsTableRow';

const releaseTag = {
  key: 'release',
  value: ['1.0.0', '2.0.0'],
};

const genericTag = {
  key: 'foo',
  value: ['bar', 'baz'],
};

describe('ReplayTagsTableRow', () => {
  it('Should render tag key and value correctly', () => {
    render(<ReplayTagsTableRow tag={genericTag} />);

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByText('baz')).toBeInTheDocument();
  });

  it('Should render release tags correctly', () => {
    render(<ReplayTagsTableRow tag={releaseTag} />);

    expect(screen.getByText('release')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('2.0.0')).toBeInTheDocument();
  });

  it('Should render the tag value as a link if we get a link result from generateUrl', () => {
    render(<ReplayTagsTableRow tag={genericTag} generateUrl={() => 'https://foo.bar'} />);

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByText('bar').closest('a')).toHaveAttribute(
      'href',
      'https://foo.bar'
    );
  });

  it('Should not render the tag value as a link if we get the value in the query prop', () => {
    render(
      <ReplayTagsTableRow
        tag={genericTag}
        generateUrl={() => 'https://foo.bar'}
        query="foo:bar"
      />
    );

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    // Expect bar to not be a link
    expect(screen.getByText('bar').closest('a')).toBeNull();
  });
});
