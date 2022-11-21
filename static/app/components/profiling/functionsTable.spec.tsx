import {ReactElement, useEffect} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {FunctionsTable} from 'sentry/components/profiling/functionsTable';
import ProjectsStore from 'sentry/stores/projectsStore';

const project = TestStubs.Project();

function TestContext({children}: {children: ReactElement}) {
  useEffect(() => {
    ProjectsStore.loadInitialData([project]);
    return () => ProjectsStore.reset();
  }, []);

  return children;
}

describe('FunctionsTable', function () {
  it('renders loading', function () {
    render(
      <TestContext>
        <FunctionsTable
          isLoading
          error={null}
          functions={[]}
          project={project}
          sort="p99"
        />
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
          functions={[]}
          project={project}
          sort="-p99"
        />
      </TestContext>
    );

    expect(screen.getByText('No results found for your query')).toBeInTheDocument();
  });

  it('renders one function', function () {
    const func = {
      count: 10,
      examples: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      fingerprint: 1234,
      name: 'foo',
      p75: 10000000,
      p95: 12000000,
      p99: 12500000,
      package: 'bar',
      path: 'baz',
      worst: 'cccccccccccccccccccccccccccccccc',
    };

    render(
      <TestContext>
        <FunctionsTable
          isLoading={false}
          error={null}
          functions={[func]}
          project={project}
          sort="-p99"
        />
      </TestContext>
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();

    expect(screen.getByText('Package')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();

    expect(screen.getByText('Total Occurrences')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    expect(screen.getByText('P75 Total Duration')).toBeInTheDocument();
    expect(screen.getByText('10.00ms')).toBeInTheDocument();

    expect(screen.getByText('P99 Total Duration')).toBeInTheDocument();
    expect(screen.getByText('12.50ms')).toBeInTheDocument();
  });

  it('renders empty name', function () {
    const func = {
      count: 10,
      examples: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      fingerprint: 1234,
      name: '',
      p75: 10000000,
      p95: 12000000,
      p99: 12500000,
      package: 'bar',
      path: 'baz',
      worst: 'cccccccccccccccccccccccccccccccc',
    };

    render(
      <TestContext>
        <FunctionsTable
          isLoading={false}
          error={null}
          functions={[func]}
          project={project}
          sort="-p99"
        />
      </TestContext>
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();

    expect(screen.getByText('Package')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('renders empty package', function () {
    const func = {
      count: 10,
      examples: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      fingerprint: 1234,
      name: 'foo',
      p75: 10000000,
      p95: 12000000,
      p99: 12500000,
      package: '',
      path: 'baz',
      worst: 'cccccccccccccccccccccccccccccccc',
    };

    render(
      <TestContext>
        <FunctionsTable
          isLoading={false}
          error={null}
          functions={[func]}
          project={project}
          sort="-p99"
        />
      </TestContext>
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();

    expect(screen.getByText('Package')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
