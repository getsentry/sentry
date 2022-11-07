import {ReactElement, useEffect} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfilesTable} from 'sentry/components/profiling/profilesTable';
import ProjectsStore from 'sentry/stores/projectsStore';

const project = TestStubs.Project();

function TestContext({children}: {children: ReactElement}) {
  useEffect(() => {
    ProjectsStore.loadInitialData([project]);
    return () => ProjectsStore.reset();
  }, []);

  return children;
}

describe('ProfilesTable', function () {
  it('renders loading', function () {
    render(
      <TestContext>
        <ProfilesTable isLoading error={null} traces={[]} />
      </TestContext>
    );
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders empty data', function () {
    render(
      <TestContext>
        <ProfilesTable isLoading={false} error={null} traces={[]} />
      </TestContext>
    );

    expect(screen.getByText('No results found for your query')).toBeInTheDocument();
  });

  it('renders one trace', function () {
    const trace = {
      android_api_level: 0,
      device_classification: 'low',
      device_locale: 'en_US',
      device_manufacturer: 'Apple',
      device_model: 'iPhone7,2',
      device_os_build_number: '14F89',
      device_os_name: 'iOS',
      device_os_version: '10.3.2',
      failed: false,
      id: '75a32ee2e6ed44458f4647b024b615bb',
      project_id: '2',
      timestamp: 1653426810,
      trace_duration_ms: 931.404667,
      transaction_id: '6051e1bfb94349a88ead9ffec6910eb9',
      transaction_name: 'iOS_Swift.ViewController',
      version_code: '1',
      version_name: '7.16.0',
    };

    render(
      <TestContext>
        <ProfilesTable isLoading={false} error={null} traces={[trace]} />
      </TestContext>
    );

    expect(screen.getByText('Status')).toBeInTheDocument();

    expect(screen.getByText('Profile ID')).toBeInTheDocument();
    expect(screen.getByText('75a32ee2')).toBeInTheDocument();

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('project-slug')).toBeInTheDocument();

    expect(screen.getByText('Transaction Name')).toBeInTheDocument();
    expect(screen.getByText('iOS_Swift.ViewController')).toBeInTheDocument();

    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('7.16.0 (build 1)')).toBeInTheDocument();

    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('May 24, 2022 9:13:30 PM UTC')).toBeInTheDocument();

    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('931.40ms')).toBeInTheDocument();

    expect(screen.getByText('Device Model')).toBeInTheDocument();
    expect(screen.getByText('iPhone7,2')).toBeInTheDocument();

    expect(screen.getByText('Device Classification')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });
});
