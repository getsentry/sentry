import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ReplayTagsTableRow from './replayTagsTableRow';

const tags = [
  {
    key: 'foo',
    value: ['bar', 'baz'],
  },
  {
    key: 'release',
    value: ['1.0.0', '2.0.0'],
  },
];

function TestComponent({children}) {
  const {organization, router} = initializeOrg();

  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {},
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
}

describe('ReplayTagsTableRow', () => {
  it('Should render tag key and value correctly', () => {
    const {getByText} = render(
      <TestComponent>
        <ReplayTagsTableRow tag={tags[0]} />
      </TestComponent>
    );

    expect(getByText('foo')).toBeInTheDocument();
    expect(getByText('bar')).toBeInTheDocument();
    expect(getByText('baz')).toBeInTheDocument();
  });

  it('Should render release tags correctly', () => {
    const {getByText} = render(
      <TestComponent>
        <ReplayTagsTableRow tag={tags[1]} />
      </TestComponent>
    );

    expect(getByText('release')).toBeInTheDocument();
    expect(getByText('1.0.0')).toBeInTheDocument();
    expect(getByText('2.0.0')).toBeInTheDocument();
  });

  it('Should render the tag value as a link if we get a link result from generateUrl', () => {
    const {getByText} = render(
      <TestComponent>
        <ReplayTagsTableRow tag={tags[0]} generateUrl={() => 'https://foo.bar'} />
      </TestComponent>
    );

    expect(getByText('foo')).toBeInTheDocument();
    expect(getByText('bar')).toBeInTheDocument();
    expect(getByText('bar').closest('a')).toHaveAttribute('href', 'https://foo.bar');
  });

  it('Should not render the tag value as la link if we get the value in the query prop', () => {
    const {getByText} = render(
      <TestComponent>
        <ReplayTagsTableRow
          tag={tags[0]}
          generateUrl={() => 'https://foo.bar'}
          query="foo:bar"
        />
      </TestComponent>
    );

    expect(getByText('foo')).toBeInTheDocument();
    expect(getByText('bar')).toBeInTheDocument();
    // Expect bar to not be a link
    expect(getByText('bar').closest('a')).toBeNull();
  });
});
