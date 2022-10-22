import {Environments} from 'fixtures/js-stubs/environments';
import {Group} from 'fixtures/js-stubs/group';
import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupReleaseStats from 'sentry/components/group/releaseStats';

describe('GroupReleaseStats', function () {
  const organization = Organization();
  const project = Project();

  const createWrapper = props =>
    render(
      <GroupReleaseStats
        group={Group()}
        project={project}
        organization={organization}
        allEnvironments={Group()}
        environments={[]}
        {...props}
      />
    );

  it('renders all environments', function () {
    createWrapper();
    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('First Seen')).toBeInTheDocument();
    // Displays counts
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('renders specific environments', function () {
    createWrapper({environments: Environments()});
    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('First Seen')).toBeInTheDocument();
    // Displays counts
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });
});
