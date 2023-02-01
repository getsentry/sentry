import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfileEventContext} from 'sentry/components/events/contexts/profile';

const organization = TestStubs.Organization({
  features: ['profiling'],
});

const profileId = '61d2d7c5acf448ffa8e2f8f973e2cd36';

const profileContext = {
  profile_id: profileId,
};

const event = TestStubs.Event();

describe('profile event context', function () {
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
        event={{...event, projectSlug: 'test-project'}}
      />,
      {organization}
    );

    expect(screen.getByText('Profile ID')).toBeInTheDocument();
    expect(screen.getByText(profileId)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Go to Profile'})).toBeInTheDocument();
  });
});
