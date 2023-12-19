import {ReactElement, useEffect} from 'react';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {FunctionsTable} from 'sentry/components/profiling/suspectFunctions/functionsTable';
import ProjectsStore from 'sentry/stores/projectsStore';

const project = ProjectFixture();

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
          analyticsPageSource="profiling_transaction"
          isLoading
          error={null}
          functions={[]}
          project={project}
          sort={{key: 'p95()', order: 'desc'}}
        />
      </TestContext>
    );
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders empty data', function () {
    render(
      <TestContext>
        <FunctionsTable
          analyticsPageSource="profiling_transaction"
          isLoading={false}
          error={null}
          functions={[]}
          project={project}
          sort={{key: 'p95()', order: 'desc'}}
        />
      </TestContext>
    );

    expect(screen.getByText('No results found for your query')).toBeInTheDocument();
  });

  it('renders one function', function () {
    const func = {
      'count()': 10,
      'examples()': [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ],
      function: 'foo',
      'p75()': 10000000,
      'sum()': 25000000,
      package: 'bar',
    };

    render(
      <TestContext>
        <FunctionsTable
          analyticsPageSource="profiling_transaction"
          isLoading={false}
          error={null}
          functions={[func]}
          project={project}
          sort={{key: 'p95()', order: 'desc'}}
        />
      </TestContext>
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();

    expect(screen.getByText('Package')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();

    expect(screen.getByText('Occurrences')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    expect(screen.getByText('P75 Self Time')).toBeInTheDocument();
    expect(screen.getByText('10.00ms')).toBeInTheDocument();

    expect(screen.getByText('Total Self Time')).toBeInTheDocument();
    expect(screen.getByText('25.00ms')).toBeInTheDocument();
  });

  it('renders empty name', function () {
    const func = {
      'count()': 10,
      'examples()': [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ],
      function: '',
      'p75()': 10000000,
      'sum()': 25000000,
      package: 'bar',
    };

    render(
      <TestContext>
        <FunctionsTable
          analyticsPageSource="profiling_transaction"
          isLoading={false}
          error={null}
          functions={[func]}
          project={project}
          sort={{key: 'p75()', order: 'desc'}}
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
      'count()': 10,
      'examples()': [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ],
      function: 'foo',
      'p75()': 10000000,
      'sum()': 25000000,
      package: '',
    };

    render(
      <TestContext>
        <FunctionsTable
          analyticsPageSource="profiling_transaction"
          isLoading={false}
          error={null}
          functions={[func]}
          project={project}
          sort={{key: 'p75()', order: 'desc'}}
        />
      </TestContext>
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();

    expect(screen.getByText('Package')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
