import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

import ReplayTagsTableRow from './replayTagsTableRow';

const releaseTag = {
  key: 'release',
  value: ['1.0.0', '2.0.0'],
};

const genericTag = {
  key: 'foo',
  value: ['bar', 'baz'],
};

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
    render(
      <TestComponent>
        <ReplayTagsTableRow tag={genericTag} />
      </TestComponent>
    );

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByText('baz')).toBeInTheDocument();
  });

  it('Should render release tags correctly', () => {
    render(
      <TestComponent>
        <ReplayTagsTableRow tag={releaseTag} />
      </TestComponent>
    );

    expect(screen.getByText('release')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('2.0.0')).toBeInTheDocument();
  });

  it('Should render the tag value as a link if we get a link result from generateUrl', () => {
    render(
      <TestComponent>
        <ReplayTagsTableRow tag={genericTag} generateUrl={() => 'https://foo.bar'} />
      </TestComponent>
    );

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByText('bar').closest('a')).toHaveAttribute(
      'href',
      'https://foo.bar'
    );
  });

  it('Should not render the tag value as a link if we get the value in the query prop', () => {
    render(
      <TestComponent>
        <ReplayTagsTableRow
          tag={genericTag}
          generateUrl={() => 'https://foo.bar'}
          query="foo:bar"
        />
      </TestComponent>
    );

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    // Expect bar to not be a link
    expect(screen.getByText('bar').closest('a')).toBeNull();
  });
});
