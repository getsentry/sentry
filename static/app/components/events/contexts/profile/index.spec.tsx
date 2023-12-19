import {Event as EventFixture} from 'sentry-fixture/event';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfileEventContext} from 'sentry/components/events/contexts/profile';
import ProjectsStore from 'sentry/stores/projectsStore';

const organization = Organization({
  features: ['profiling'],
});

const profileId = '61d2d7c5acf448ffa8e2f8f973e2cd36';

const profileContext = {
  profile_id: profileId,
};

const event = EventFixture();
const project = ProjectFixture();

describe('profile event context', function () {
  beforeEach(function () {
    act(() => ProjectsStore.loadInitialData([project]));
  });

  it('renders empty context', function () {
    render(<ProfileEventContext data={{}} event={event} />, {organization});
  });

  it('renders profile id', function () {
    render(<ProfileEventContext data={profileContext} event={event} />, {organization});

    expect(screen.getByText('Profile ID')).toBeInTheDocument();
    expect(screen.getByText(profileId)).toBeInTheDocument();
  });

  it('renders profile id with button', function () {
    render(
      <ProfileEventContext
        data={profileContext}
        event={{...event, projectID: project.id}}
      />,
      {organization}
    );

    expect(screen.getByText('Profile ID')).toBeInTheDocument();
    expect(screen.getByText(profileId)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Profile'})).toBeInTheDocument();
  });
});
