import {ReactElement, useEffect, useMemo} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {FunctionsTable} from 'sentry/components/profiling/functionsTable';
import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

const organization = TestStubs.Organization();
const project = TestStubs.Project();

function TestContext({children}: {children: ReactElement}) {
  const {router} = useMemo(() => initializeOrg({organization, project} as any), []);

  useEffect(() => {
    ProjectsStore.loadInitialData([project]);
    return () => ProjectsStore.reset();
  }, []);

  return (
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {},
        routes: [],
      }}
    >
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    </RouteContext.Provider>
  );
}

describe('FunctionsTable', function () {
  it('renders loading', function () {
    render(
      <TestContext>
        <FunctionsTable isLoading error={null} functionCalls={[]} project={project} />
      </TestContext>
    );
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders empty data', function () {
    render(
      <TestContext>
        <FunctionsTable
          isLoading={false}
          error={null}
          functionCalls={[]}
          project={project}
        />
      </TestContext>
    );

    expect(screen.getByText('No results found for your query')).toBeInTheDocument();
  });

  it('renders one function', function () {
    const func = {
      image: 'libnetwork.dylib',
      symbol: 'nw_endpoint_flow_setup_socket',
      duration_ns: {
        p50: 458843541,
        p75: 468843541,
        p90: 478843541,
        p95: 488843541,
        p99: 498843541,
      },
      duration_ns_values: null,
      frequency: {
        p50: 0,
        p75: 0,
        p90: 0.6333333333333346,
        p95: 1,
        p99: 1,
      },
      frequency_values: null,
      thread_name_to_percent: {
        '': 1,
      },
      line: 0,
      path: '',
      main_thread_percent: 0.33,
      profile_ids: ['75a32ee2e6ed44458f4647b024b615bb'],
      profile_id_to_thread_id: {
        '75a32ee2e6ed44458f4647b024b615bb': 23555,
      },
      key: '0dd7251302785a3be078d2a5200016fc',
      transaction_names: ['iOS_Swift.ViewController'],
    };

    render(
      <TestContext>
        <FunctionsTable
          isLoading={false}
          error={null}
          functionCalls={[func]}
          project={project}
        />
      </TestContext>
    );

    expect(screen.getByText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('nw_endpoint_flow_setup_socket')).toBeInTheDocument();

    expect(screen.getByText('Binary')).toBeInTheDocument();
    expect(screen.getByText('libnetwork.dylib')).toBeInTheDocument();

    expect(screen.getByText('P75 Duration')).toBeInTheDocument();
    expect(screen.getByText('468.84ms')).toBeInTheDocument();

    expect(screen.getByText('P99 Duration')).toBeInTheDocument();
    expect(screen.getByText('498.84ms')).toBeInTheDocument();

    expect(screen.getByText('Main Thread %')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();

    expect(screen.getByText('P75 Frequency')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();

    expect(screen.getByText('P99 Frequency')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
